package app.ironvault.iap

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.*
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

/**
 * IronVault IAP Plugin - Android Implementation using Google Play Billing v6+
 *
 * Handles in-app purchases for subscriptions and one-time purchases.
 */
@CapacitorPlugin(name = "IronvaultIap")
class IronvaultIapPlugin : Plugin(), PurchasesUpdatedListener {

    private lateinit var billingClient: BillingClient
    private val productDetailsMap = mutableMapOf<String, ProductDetails>()
    private var pendingPurchaseCall: PluginCall? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    override fun load() {
        billingClient = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases()
            .build()
        
        connectBillingClient()
    }

    override fun handleOnDestroy() {
        scope.cancel()
        if (billingClient.isReady) {
            billingClient.endConnection()
        }
    }

    private fun connectBillingClient() {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    android.util.Log.d("IronvaultIap", "Billing client connected")
                } else {
                    android.util.Log.e("IronvaultIap", "Billing setup failed: ${billingResult.debugMessage}")
                }
            }

            override fun onBillingServiceDisconnected() {
                android.util.Log.w("IronvaultIap", "Billing service disconnected, reconnecting...")
                // Try to reconnect
                connectBillingClient()
            }
        })
    }

    // MARK: - PurchasesUpdatedListener

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: List<Purchase>?) {
        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases?.forEach { purchase ->
                    scope.launch {
                        handlePurchase(purchase)
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                pendingPurchaseCall?.resolve(JSObject().apply {
                    put("success", false)
                    put("error", JSObject().apply {
                        put("code", "USER_CANCELLED")
                        put("message", "Purchase was cancelled by user")
                        put("userCancelled", true)
                    })
                })
                pendingPurchaseCall = null
            }
            else -> {
                pendingPurchaseCall?.resolve(JSObject().apply {
                    put("success", false)
                    put("error", JSObject().apply {
                        put("code", mapBillingError(billingResult.responseCode))
                        put("message", billingResult.debugMessage ?: "Purchase failed")
                        put("userCancelled", false)
                    })
                })
                pendingPurchaseCall = null
            }
        }
    }

    private suspend fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            // Acknowledge the purchase if not already acknowledged
            if (!purchase.isAcknowledged) {
                val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
                
                val result = withContext(Dispatchers.IO) {
                    billingClient.acknowledgePurchase(acknowledgePurchaseParams) { }
                }
            }

            // Get product details for this purchase
            val productId = purchase.products.firstOrNull() ?: return
            val productDetails = productDetailsMap[productId]
            
            // Build entitlements
            val entitlements = buildEntitlementsFromPurchase(purchase, productDetails)

            // Notify pending call if exists
            pendingPurchaseCall?.resolve(JSObject().apply {
                put("success", true)
                put("transactionId", purchase.orderId ?: purchase.purchaseToken)
                put("productId", productId)
                put("purchaseDate", dateFormat.format(Date(purchase.purchaseTime)))
                put("entitlements", entitlements)
            })
            pendingPurchaseCall = null

            // Notify listeners
            notifyListeners("transactionUpdate", JSObject().apply {
                put("type", "purchased")
                put("transactionId", purchase.orderId ?: purchase.purchaseToken)
                put("productId", productId)
                put("entitlements", entitlements)
            })
        } else if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
            pendingPurchaseCall?.resolve(JSObject().apply {
                put("success", false)
                put("error", JSObject().apply {
                    put("code", "PURCHASE_PENDING")
                    put("message", "Purchase is pending approval")
                    put("userCancelled", false)
                })
            })
            pendingPurchaseCall = null
        }
    }

    // MARK: - Get Products

    @PluginMethod
    fun getProducts(call: PluginCall) {
        val productIds = call.getArray("productIds")?.toList<String>()
        if (productIds.isNullOrEmpty()) {
            call.reject("Missing productIds parameter")
            return
        }

        scope.launch {
            try {
                ensureBillingClientReady()

                val products = mutableListOf<JSObject>()
                
                // Query subscriptions
                val subsParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        productIds.filter { it.contains("monthly") || it.contains("yearly") }
                            .map { productId ->
                                QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(productId)
                                    .setProductType(BillingClient.ProductType.SUBS)
                                    .build()
                            }
                    )
                    .build()

                if (subsParams.productList.isNotEmpty()) {
                    val subsResult = withContext(Dispatchers.IO) {
                        billingClient.queryProductDetails(subsParams)
                    }
                    subsResult.productDetailsList?.forEach { details ->
                        productDetailsMap[details.productId] = details
                        products.add(productDetailsToJson(details))
                    }
                }

                // Query one-time products (lifetime)
                val inappParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        productIds.filter { it.contains("lifetime") }
                            .map { productId ->
                                QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(productId)
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build()
                            }
                    )
                    .build()

                if (inappParams.productList.isNotEmpty()) {
                    val inappResult = withContext(Dispatchers.IO) {
                        billingClient.queryProductDetails(inappParams)
                    }
                    inappResult.productDetailsList?.forEach { details ->
                        productDetailsMap[details.productId] = details
                        products.add(productDetailsToJson(details))
                    }
                }

                call.resolve(JSObject().apply {
                    put("products", JSArray(products))
                })
            } catch (e: Exception) {
                call.reject("Failed to fetch products: ${e.message}")
            }
        }
    }

    // MARK: - Purchase

    @PluginMethod
    fun purchase(call: PluginCall) {
        val productId = call.getString("productId")
        if (productId.isNullOrEmpty()) {
            call.reject("Missing productId parameter")
            return
        }

        scope.launch {
            try {
                ensureBillingClientReady()

                var productDetails = productDetailsMap[productId]
                
                // Fetch product details if not cached
                if (productDetails == null) {
                    val productType = if (productId.contains("lifetime")) {
                        BillingClient.ProductType.INAPP
                    } else {
                        BillingClient.ProductType.SUBS
                    }

                    val params = QueryProductDetailsParams.newBuilder()
                        .setProductList(
                            listOf(
                                QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(productId)
                                    .setProductType(productType)
                                    .build()
                            )
                        )
                        .build()

                    val result = withContext(Dispatchers.IO) {
                        billingClient.queryProductDetails(params)
                    }

                    productDetails = result.productDetailsList?.firstOrNull()
                    if (productDetails != null) {
                        productDetailsMap[productId] = productDetails
                    }
                }

                if (productDetails == null) {
                    call.resolve(JSObject().apply {
                        put("success", false)
                        put("error", JSObject().apply {
                            put("code", "PRODUCT_NOT_FOUND")
                            put("message", "Product not found: $productId")
                            put("userCancelled", false)
                        })
                    })
                    return@launch
                }

                // Build purchase params
                val productDetailsParamsList = listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .apply {
                            // For subscriptions, select the base plan offer
                            productDetails.subscriptionOfferDetails?.firstOrNull()?.let { offer ->
                                setOfferToken(offer.offerToken)
                            }
                        }
                        .build()
                )

                val billingFlowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(productDetailsParamsList)
                    .build()

                // Store the call for later resolution
                pendingPurchaseCall = call

                // Launch billing flow
                val billingResult = billingClient.launchBillingFlow(activity, billingFlowParams)
                
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    pendingPurchaseCall = null
                    call.resolve(JSObject().apply {
                        put("success", false)
                        put("error", JSObject().apply {
                            put("code", mapBillingError(billingResult.responseCode))
                            put("message", billingResult.debugMessage ?: "Failed to launch billing flow")
                            put("userCancelled", false)
                        })
                    })
                }
            } catch (e: Exception) {
                pendingPurchaseCall = null
                call.reject("Purchase failed: ${e.message}")
            }
        }
    }

    // MARK: - Restore Purchases

    @PluginMethod
    fun restorePurchases(call: PluginCall) {
        scope.launch {
            try {
                ensureBillingClientReady()

                var restoredCount = 0
                var latestEntitlements: JSObject? = null

                // Query subscriptions
                val subsParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()

                val subsResult = withContext(Dispatchers.IO) {
                    billingClient.queryPurchasesAsync(subsParams)
                }

                subsResult.purchasesList.forEach { purchase ->
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        restoredCount++
                        val productId = purchase.products.firstOrNull()
                        val productDetails = productId?.let { productDetailsMap[it] }
                        latestEntitlements = buildEntitlementsFromPurchase(purchase, productDetails)
                    }
                }

                // Query one-time purchases
                val inappParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()

                val inappResult = withContext(Dispatchers.IO) {
                    billingClient.queryPurchasesAsync(inappParams)
                }

                inappResult.purchasesList.forEach { purchase ->
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        restoredCount++
                        val productId = purchase.products.firstOrNull()
                        val productDetails = productId?.let { productDetailsMap[it] }
                        latestEntitlements = buildEntitlementsFromPurchase(purchase, productDetails)
                    }
                }

                call.resolve(JSObject().apply {
                    put("success", true)
                    put("restoredCount", restoredCount)
                    put("entitlements", latestEntitlements ?: buildFreeEntitlements())
                })
            } catch (e: Exception) {
                call.resolve(JSObject().apply {
                    put("success", false)
                    put("restoredCount", 0)
                    put("error", JSObject().apply {
                        put("code", "RESTORE_FAILED")
                        put("message", e.message ?: "Failed to restore purchases")
                    })
                })
            }
        }
    }

    // MARK: - Get Customer Entitlements

    @PluginMethod
    fun getCustomerEntitlements(call: PluginCall) {
        scope.launch {
            try {
                ensureBillingClientReady()

                var entitlements = buildFreeEntitlements()

                // Check subscriptions
                val subsParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()

                val subsResult = withContext(Dispatchers.IO) {
                    billingClient.queryPurchasesAsync(subsParams)
                }

                subsResult.purchasesList.firstOrNull { 
                    it.purchaseState == Purchase.PurchaseState.PURCHASED 
                }?.let { purchase ->
                    val productId = purchase.products.firstOrNull()
                    val productDetails = productId?.let { productDetailsMap[it] }
                    entitlements = buildEntitlementsFromPurchase(purchase, productDetails)
                }

                // Check one-time purchases if no active subscription
                if (entitlements.getString("plan") == "FREE") {
                    val inappParams = QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()

                    val inappResult = withContext(Dispatchers.IO) {
                        billingClient.queryPurchasesAsync(inappParams)
                    }

                    inappResult.purchasesList.firstOrNull {
                        it.purchaseState == Purchase.PurchaseState.PURCHASED
                    }?.let { purchase ->
                        val productId = purchase.products.firstOrNull()
                        val productDetails = productId?.let { productDetailsMap[it] }
                        entitlements = buildEntitlementsFromPurchase(purchase, productDetails)
                    }
                }

                call.resolve(JSObject().apply {
                    put("entitlements", entitlements)
                })
            } catch (e: Exception) {
                call.resolve(JSObject().apply {
                    put("entitlements", buildFreeEntitlements())
                })
            }
        }
    }

    // MARK: - Get Active Subscription Status

    @PluginMethod
    fun getActiveSubscriptionStatus(call: PluginCall) {
        scope.launch {
            try {
                ensureBillingClientReady()

                var hasActive = false
                var subscriptionInfo: JSObject? = null

                val subsParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()

                val result = withContext(Dispatchers.IO) {
                    billingClient.queryPurchasesAsync(subsParams)
                }

                result.purchasesList.firstOrNull {
                    it.purchaseState == Purchase.PurchaseState.PURCHASED
                }?.let { purchase ->
                    hasActive = true
                    val productId = purchase.products.firstOrNull() ?: ""
                    
                    subscriptionInfo = JSObject().apply {
                        put("productId", productId)
                        put("expirationDate", "") // Google doesn't provide this directly
                        put("willRenew", purchase.isAutoRenewing)
                        put("isInGracePeriod", false)
                        put("isInBillingRetry", false)
                        put("isTrial", false) // Would need to track this separately
                    }
                }

                // Also check for lifetime purchases
                if (!hasActive) {
                    val inappParams = QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()

                    val inappResult = withContext(Dispatchers.IO) {
                        billingClient.queryPurchasesAsync(inappParams)
                    }

                    inappResult.purchasesList.firstOrNull {
                        it.purchaseState == Purchase.PurchaseState.PURCHASED &&
                        it.products.any { p -> p.contains("lifetime") }
                    }?.let { purchase ->
                        hasActive = true
                        subscriptionInfo = JSObject().apply {
                            put("productId", purchase.products.firstOrNull() ?: "")
                            put("expirationDate", "")
                            put("willRenew", false)
                            put("isInGracePeriod", false)
                            put("isInBillingRetry", false)
                            put("isTrial", false)
                        }
                    }
                }

                call.resolve(JSObject().apply {
                    put("hasActiveSubscription", hasActive)
                    subscriptionInfo?.let { put("subscription", it) }
                })
            } catch (e: Exception) {
                call.resolve(JSObject().apply {
                    put("hasActiveSubscription", false)
                })
            }
        }
    }

    // MARK: - Get Intro Offer Status

    @PluginMethod
    fun getIntroOfferStatus(call: PluginCall) {
        val productId = call.getString("productId")
        if (productId.isNullOrEmpty()) {
            call.reject("Missing productId parameter")
            return
        }

        scope.launch {
            try {
                ensureBillingClientReady()

                var productDetails = productDetailsMap[productId]

                if (productDetails == null) {
                    val params = QueryProductDetailsParams.newBuilder()
                        .setProductList(
                            listOf(
                                QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(productId)
                                    .setProductType(BillingClient.ProductType.SUBS)
                                    .build()
                            )
                        )
                        .build()

                    val result = withContext(Dispatchers.IO) {
                        billingClient.queryProductDetails(params)
                    }

                    productDetails = result.productDetailsList?.firstOrNull()
                }

                // Check for free trial offer
                val freeTrialOffer = productDetails?.subscriptionOfferDetails?.find { offer ->
                    offer.pricingPhases.pricingPhaseList.any { phase ->
                        phase.priceAmountMicros == 0L
                    }
                }

                if (freeTrialOffer != null) {
                    val trialPhase = freeTrialOffer.pricingPhases.pricingPhaseList.find {
                        it.priceAmountMicros == 0L
                    }

                    call.resolve(JSObject().apply {
                        put("eligible", true)
                        trialPhase?.let { phase ->
                            put("offer", JSObject().apply {
                                put("price", 0)
                                put("localizedPrice", "Free")
                                put("periodUnit", parsePeriodUnit(phase.billingPeriod))
                                put("periodCount", parsePeriodCount(phase.billingPeriod))
                                put("cycles", phase.billingCycleCount)
                                put("type", "freeTrial")
                            })
                        }
                    })
                } else {
                    call.resolve(JSObject().apply {
                        put("eligible", false)
                    })
                }
            } catch (e: Exception) {
                call.resolve(JSObject().apply {
                    put("eligible", false)
                })
            }
        }
    }

    // MARK: - Open Manage Subscriptions

    @PluginMethod
    fun openManageSubscriptions(call: PluginCall) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("https://play.google.com/store/account/subscriptions")
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open subscription management: ${e.message}")
        }
    }

    // MARK: - Helper Methods

    private suspend fun ensureBillingClientReady() {
        if (!billingClient.isReady) {
            suspendCancellableCoroutine<Unit> { continuation ->
                billingClient.startConnection(object : BillingClientStateListener {
                    override fun onBillingSetupFinished(billingResult: BillingResult) {
                        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                            continuation.resume(Unit) {}
                        } else {
                            continuation.cancel(Exception("Billing setup failed"))
                        }
                    }

                    override fun onBillingServiceDisconnected() {
                        continuation.cancel(Exception("Billing service disconnected"))
                    }
                })
            }
        }
    }

    private fun productDetailsToJson(details: ProductDetails): JSObject {
        return JSObject().apply {
            put("id", details.productId)
            put("localizedTitle", details.title)
            put("localizedDescription", details.description)

            // Handle subscription pricing
            details.subscriptionOfferDetails?.firstOrNull()?.let { offer ->
                val basePrice = offer.pricingPhases.pricingPhaseList.lastOrNull()
                basePrice?.let { price ->
                    put("localizedPrice", price.formattedPrice)
                    put("price", price.priceAmountMicros / 1_000_000.0)
                    put("currencyCode", price.priceCurrencyCode)
                    put("productType", "subscription")
                    put("subscriptionPeriod", price.billingPeriod)
                    put("subscriptionPeriodUnit", parsePeriodUnit(price.billingPeriod))
                    put("subscriptionPeriodCount", parsePeriodCount(price.billingPeriod))
                }

                // Check for intro offer
                val introPhase = offer.pricingPhases.pricingPhaseList.find {
                    it.priceAmountMicros == 0L || 
                    offer.pricingPhases.pricingPhaseList.indexOf(it) == 0
                }
                if (introPhase != null && introPhase.priceAmountMicros == 0L) {
                    put("introOffer", JSObject().apply {
                        put("price", 0)
                        put("localizedPrice", "Free")
                        put("periodUnit", parsePeriodUnit(introPhase.billingPeriod))
                        put("periodCount", parsePeriodCount(introPhase.billingPeriod))
                        put("cycles", introPhase.billingCycleCount)
                        put("type", "freeTrial")
                    })
                }
            }

            // Handle one-time purchase pricing
            details.oneTimePurchaseOfferDetails?.let { offer ->
                put("localizedPrice", offer.formattedPrice)
                put("price", offer.priceAmountMicros / 1_000_000.0)
                put("currencyCode", offer.priceCurrencyCode)
                put("productType", "nonConsumable")
            }
        }
    }

    private fun buildEntitlementsFromPurchase(purchase: Purchase, productDetails: ProductDetails?): JSObject {
        val productId = purchase.products.firstOrNull() ?: ""
        val plan = when {
            productId.contains("lifetime") -> "LIFETIME"
            else -> "PREMIUM"
        }

        return JSObject().apply {
            put("plan", plan)
            put("isActive", true)
            put("isTrial", false) // Would need separate tracking for trial status
            put("willRenew", purchase.isAutoRenewing)
            put("productId", productId)
            put("platform", "android")
            put("store", "play_store")
            put("originalPurchaseDate", dateFormat.format(Date(purchase.purchaseTime)))
            put("latestPurchaseDate", dateFormat.format(Date(purchase.purchaseTime)))
        }
    }

    private fun buildFreeEntitlements(): JSObject {
        return JSObject().apply {
            put("plan", "FREE")
            put("isActive", true)
            put("isTrial", false)
            put("willRenew", false)
            put("platform", "android")
            put("store", "play_store")
        }
    }

    private fun mapBillingError(responseCode: Int): String {
        return when (responseCode) {
            BillingClient.BillingResponseCode.USER_CANCELED -> "USER_CANCELLED"
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> "BILLING_UNAVAILABLE"
            BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> "BILLING_UNAVAILABLE"
            BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "PRODUCT_NOT_FOUND"
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "ITEM_ALREADY_OWNED"
            BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> "ITEM_NOT_OWNED"
            BillingClient.BillingResponseCode.NETWORK_ERROR -> "NETWORK_ERROR"
            else -> "UNKNOWN"
        }
    }

    private fun parsePeriodUnit(period: String): String {
        return when {
            period.contains("D") -> "day"
            period.contains("W") -> "week"
            period.contains("M") -> "month"
            period.contains("Y") -> "year"
            else -> "month"
        }
    }

    private fun parsePeriodCount(period: String): Int {
        val regex = Regex("P(\\d+)[DWMY]")
        val match = regex.find(period)
        return match?.groupValues?.get(1)?.toIntOrNull() ?: 1
    }
}
