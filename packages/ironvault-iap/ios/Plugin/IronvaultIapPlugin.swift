import Foundation
import Capacitor
import StoreKit

/**
 * IronVault IAP Plugin - iOS Implementation using StoreKit 2
 *
 * Handles in-app purchases for subscriptions and one-time purchases.
 * Uses modern async/await APIs from StoreKit 2.
 */
@objc(IronvaultIapPlugin)
public class IronvaultIapPlugin: CAPPlugin {
    
    private var transactionListener: Task<Void, Error>?
    private var products: [String: Product] = [:]
    
    public override func load() {
        // Start listening for transactions on plugin load
        startTransactionListener()
    }
    
    deinit {
        transactionListener?.cancel()
    }
    
    // MARK: - Transaction Listener
    
    private func startTransactionListener() {
        transactionListener = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self = self else { return }
                
                do {
                    let transaction = try self.checkVerified(result)
                    
                    // Notify JS layer
                    await MainActor.run {
                        self.notifyListeners("transactionUpdate", data: [
                            "type": "purchased",
                            "transactionId": String(transaction.id),
                            "productId": transaction.productID,
                            "entitlements": self.buildEntitlementsDict(from: transaction)
                        ])
                    }
                    
                    // Always finish the transaction
                    await transaction.finish()
                } catch {
                    print("[IronvaultIap] Transaction verification failed: \(error)")
                }
            }
        }
    }
    
    // MARK: - Get Products
    
    @objc func getProducts(_ call: CAPPluginCall) {
        guard let productIds = call.getArray("productIds", String.self) else {
            call.reject("Missing productIds parameter")
            return
        }
        
        Task {
            do {
                let storeProducts = try await Product.products(for: Set(productIds))
                
                // Cache products
                for product in storeProducts {
                    self.products[product.id] = product
                }
                
                let productsArray = storeProducts.map { product in
                    self.productToDict(product)
                }
                
                call.resolve(["products": productsArray])
            } catch {
                call.reject("Failed to fetch products: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Purchase
    
    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId parameter")
            return
        }
        
        Task {
            do {
                // Get product if not cached
                let product: Product
                if let cached = self.products[productId] {
                    product = cached
                } else {
                    let products = try await Product.products(for: [productId])
                    guard let foundProduct = products.first else {
                        call.resolve([
                            "success": false,
                            "error": [
                                "code": "PRODUCT_NOT_FOUND",
                                "message": "Product not found: \(productId)",
                                "userCancelled": false
                            ]
                        ])
                        return
                    }
                    product = foundProduct
                    self.products[productId] = product
                }
                
                // Start purchase
                let result = try await product.purchase()
                
                switch result {
                case .success(let verification):
                    let transaction = try self.checkVerified(verification)
                    
                    // Finish the transaction
                    await transaction.finish()
                    
                    call.resolve([
                        "success": true,
                        "transactionId": String(transaction.id),
                        "productId": transaction.productID,
                        "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                        "expirationDate": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } as Any,
                        "entitlements": self.buildEntitlementsDict(from: transaction)
                    ])
                    
                case .userCancelled:
                    call.resolve([
                        "success": false,
                        "error": [
                            "code": "USER_CANCELLED",
                            "message": "Purchase was cancelled by user",
                            "userCancelled": true
                        ]
                    ])
                    
                case .pending:
                    call.resolve([
                        "success": false,
                        "error": [
                            "code": "PURCHASE_PENDING",
                            "message": "Purchase is pending approval",
                            "userCancelled": false
                        ]
                    ])
                    
                @unknown default:
                    call.resolve([
                        "success": false,
                        "error": [
                            "code": "UNKNOWN",
                            "message": "Unknown purchase result",
                            "userCancelled": false
                        ]
                    ])
                }
            } catch {
                call.resolve([
                    "success": false,
                    "error": [
                        "code": "UNKNOWN",
                        "message": error.localizedDescription,
                        "userCancelled": false
                    ]
                ])
            }
        }
    }
    
    // MARK: - Restore Purchases
    
    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                // Sync with App Store
                try await AppStore.sync()
                
                var restoredCount = 0
                var latestEntitlements: [String: Any]?
                
                // Check all current entitlements
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result {
                        restoredCount += 1
                        latestEntitlements = self.buildEntitlementsDict(from: transaction)
                    }
                }
                
                call.resolve([
                    "success": true,
                    "restoredCount": restoredCount,
                    "entitlements": latestEntitlements ?? self.buildFreeEntitlements()
                ])
            } catch {
                call.resolve([
                    "success": false,
                    "restoredCount": 0,
                    "error": [
                        "code": "RESTORE_FAILED",
                        "message": error.localizedDescription
                    ]
                ])
            }
        }
    }
    
    // MARK: - Get Customer Entitlements
    
    @objc func getCustomerEntitlements(_ call: CAPPluginCall) {
        Task {
            var entitlements: [String: Any] = self.buildFreeEntitlements()
            
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result {
                    entitlements = self.buildEntitlementsDict(from: transaction)
                    break // Use the first active entitlement
                }
            }
            
            call.resolve(["entitlements": entitlements])
        }
    }
    
    // MARK: - Get Active Subscription Status
    
    @objc func getActiveSubscriptionStatus(_ call: CAPPluginCall) {
        Task {
            var hasActive = false
            var subscriptionInfo: [String: Any]?
            
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result {
                    // Check if this is a subscription
                    if transaction.productType == .autoRenewable {
                        hasActive = true
                        
                        let renewalInfo = await self.getSubscriptionRenewalInfo(for: transaction.productID)
                        
                        subscriptionInfo = [
                            "productId": transaction.productID,
                            "expirationDate": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } ?? "",
                            "willRenew": renewalInfo?.willAutoRenew ?? false,
                            "isInGracePeriod": renewalInfo?.isInBillingRetry ?? false,
                            "isInBillingRetry": renewalInfo?.isInBillingRetry ?? false,
                            "isTrial": transaction.offerType == .introductory,
                            "trialEndsAt": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } as Any
                        ]
                        break
                    } else if transaction.productType == .nonConsumable {
                        // Lifetime purchase
                        hasActive = true
                        subscriptionInfo = [
                            "productId": transaction.productID,
                            "expirationDate": "",
                            "willRenew": false,
                            "isInGracePeriod": false,
                            "isInBillingRetry": false,
                            "isTrial": false
                        ]
                        break
                    }
                }
            }
            
            var result: [String: Any] = ["hasActiveSubscription": hasActive]
            if let info = subscriptionInfo {
                result["subscription"] = info
            }
            call.resolve(result)
        }
    }
    
    // MARK: - Get Intro Offer Status
    
    @objc func getIntroOfferStatus(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId parameter")
            return
        }
        
        Task {
            do {
                let product: Product
                if let cached = self.products[productId] {
                    product = cached
                } else {
                    let products = try await Product.products(for: [productId])
                    guard let foundProduct = products.first else {
                        call.resolve(["eligible": false])
                        return
                    }
                    product = foundProduct
                }
                
                // Check eligibility for introductory offer
                let eligible = await product.subscription?.isEligibleForIntroOffer ?? false
                
                var result: [String: Any] = ["eligible": eligible]
                
                if eligible, let intro = product.subscription?.introductoryOffer {
                    result["offer"] = [
                        "price": intro.price as NSDecimalNumber,
                        "localizedPrice": intro.displayPrice,
                        "periodUnit": self.periodUnitToString(intro.period.unit),
                        "periodCount": intro.period.value,
                        "cycles": intro.periodCount,
                        "type": self.offerTypeToString(intro.paymentMode)
                    ]
                }
                
                call.resolve(result)
            } catch {
                call.resolve(["eligible": false])
            }
        }
    }
    
    // MARK: - Open Manage Subscriptions
    
    @objc func openManageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                do {
                    try await AppStore.showManageSubscriptions(in: windowScene)
                    call.resolve()
                } catch {
                    call.reject("Failed to open subscription management: \(error.localizedDescription)")
                }
            } else {
                call.reject("Unable to find window scene")
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let item):
            return item
        }
    }
    
    private func productToDict(_ product: Product) -> [String: Any] {
        var dict: [String: Any] = [
            "id": product.id,
            "localizedTitle": product.displayName,
            "localizedDescription": product.description,
            "localizedPrice": product.displayPrice,
            "price": product.price as NSDecimalNumber,
            "currencyCode": product.priceFormatStyle.currencyCode ?? "USD",
            "productType": self.productTypeToString(product.type)
        ]
        
        if let subscription = product.subscription {
            dict["subscriptionPeriod"] = self.periodToISO8601(subscription.subscriptionPeriod)
            dict["subscriptionPeriodUnit"] = self.periodUnitToString(subscription.subscriptionPeriod.unit)
            dict["subscriptionPeriodCount"] = subscription.subscriptionPeriod.value
            
            if let intro = subscription.introductoryOffer {
                dict["introOffer"] = [
                    "price": intro.price as NSDecimalNumber,
                    "localizedPrice": intro.displayPrice,
                    "periodUnit": self.periodUnitToString(intro.period.unit),
                    "periodCount": intro.period.value,
                    "cycles": intro.periodCount,
                    "type": self.offerTypeToString(intro.paymentMode)
                ]
            }
        }
        
        return dict
    }
    
    private func buildEntitlementsDict(from transaction: Transaction) -> [String: Any] {
        let plan: String
        let isTrial = transaction.offerType == .introductory
        
        if transaction.productID.contains("lifetime") {
            plan = "LIFETIME"
        } else if isTrial {
            plan = "TRIAL"
        } else {
            plan = "PREMIUM"
        }
        
        return [
            "plan": plan,
            "isActive": true,
            "isTrial": isTrial,
            "trialEndsAt": isTrial ? (transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } ?? "") : "",
            "expirationDate": transaction.expirationDate.map { ISO8601DateFormatter().string(from: $0) } ?? "",
            "willRenew": true, // Will be updated by renewal info
            "productId": transaction.productID,
            "platform": "ios",
            "store": "app_store",
            "originalPurchaseDate": ISO8601DateFormatter().string(from: transaction.originalPurchaseDate),
            "latestPurchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate)
        ]
    }
    
    private func buildFreeEntitlements() -> [String: Any] {
        return [
            "plan": "FREE",
            "isActive": true,
            "isTrial": false,
            "willRenew": false,
            "platform": "ios",
            "store": "app_store"
        ]
    }
    
    private func getSubscriptionRenewalInfo(for productId: String) async -> Product.SubscriptionInfo.RenewalInfo? {
        guard let product = self.products[productId],
              let subscription = product.subscription else {
            return nil
        }
        
        for await result in subscription.status {
            if case .verified(let renewalInfo) = result.renewalInfo {
                return renewalInfo
            }
        }
        return nil
    }
    
    private func productTypeToString(_ type: Product.ProductType) -> String {
        switch type {
        case .autoRenewable: return "subscription"
        case .nonConsumable: return "nonConsumable"
        case .consumable: return "consumable"
        case .nonRenewable: return "subscription"
        @unknown default: return "unknown"
        }
    }
    
    private func periodUnitToString(_ unit: Product.SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return "unknown"
        }
    }
    
    private func periodToISO8601(_ period: Product.SubscriptionPeriod) -> String {
        switch period.unit {
        case .day: return "P\(period.value)D"
        case .week: return "P\(period.value)W"
        case .month: return "P\(period.value)M"
        case .year: return "P\(period.value)Y"
        @unknown default: return "P\(period.value)D"
        }
    }
    
    private func offerTypeToString(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payUpFront: return "payUpFront"
        case .payAsYouGo: return "payAsYouGo"
        @unknown default: return "unknown"
        }
    }
}
