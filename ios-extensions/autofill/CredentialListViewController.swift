//
//  CredentialListViewController.swift
//  IronVaultAutoFill
//
//  Dark-themed credential picker presented inside the AutoFill modal.
//
//  The host (CredentialProviderViewController) populates `suggested` and
//  `all` based on the AS service identifiers iOS handed us. The user
//  picks a row → we call `delegate.didSelect(_:)`. Biometric is handled
//  by the host before the credential is returned to the form — this view
//  controller only deals with selection UI.
//
//  Design language matches the IronVault app:
//    - Near-black gradient background
//    - Vault-icon header with the host name we're filling
//    - Search bar with subtle glass-style chrome
//    - Cards (rounded 14pt) with a colored avatar + username + masked password
//

import UIKit

protocol CredentialListViewControllerDelegate: AnyObject {
    func credentialList(_ vc: CredentialListViewController, didSelect credential: AutoFillCredential)
    func credentialListDidCancel(_ vc: CredentialListViewController)
}

final class CredentialListViewController: UIViewController {

    weak var delegate: CredentialListViewControllerDelegate?

    var suggested: [AutoFillCredential] = []
    var all: [AutoFillCredential] = []
    var serviceLabel: String?      // e.g. "github.com" — shown in header
    var biometricKind: BiometricHelper.BiometricKind = .none

    private var filteredSuggested: [AutoFillCredential] = []
    private var filteredAll: [AutoFillCredential] = []

    private let searchBar = UISearchBar()
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private let emptyLabel = UILabel()

    private enum Section: Int, CaseIterable {
        case suggested
        case all
    }

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackground()
        setupNav()
        setupHeader()
        setupTable()
        applyFilter("")
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(false, animated: false)
    }

    // MARK: Setup

    private func setupBackground() {
        view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1) // near-black navy

        let gradient = CAGradientLayer()
        gradient.frame = view.bounds
        gradient.colors = [
            UIColor(red: 0.06, green: 0.07, blue: 0.13, alpha: 1).cgColor,
            UIColor(red: 0.03, green: 0.04, blue: 0.07, alpha: 1).cgColor,
        ]
        gradient.startPoint = CGPoint(x: 0.5, y: 0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1)
        gradient.name = "iv.bg"
        view.layer.insertSublayer(gradient, at: 0)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        view.layer.sublayers?.first(where: { $0.name == "iv.bg" })?.frame = view.bounds
    }

    private func setupNav() {
        title = "IronVault"
        navigationController?.navigationBar.prefersLargeTitles = false
        navigationController?.navigationBar.tintColor = ironVaultAccent
        navigationController?.navigationBar.titleTextAttributes = [
            .foregroundColor: UIColor.white,
            .font: UIFont.systemFont(ofSize: 17, weight: .semibold),
        ]
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1)
        appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        appearance.shadowColor = .clear
        navigationController?.navigationBar.standardAppearance = appearance
        navigationController?.navigationBar.scrollEdgeAppearance = appearance

        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )
    }

    private func setupHeader() {
        let header = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 132))
        header.translatesAutoresizingMaskIntoConstraints = false

        let iconBg = UIView()
        iconBg.translatesAutoresizingMaskIntoConstraints = false
        iconBg.backgroundColor = ironVaultAccent.withAlphaComponent(0.18)
        iconBg.layer.cornerRadius = 14
        iconBg.layer.borderWidth = 1
        iconBg.layer.borderColor = ironVaultAccent.withAlphaComponent(0.35).cgColor

        let icon = UIImageView(image: UIImage(systemName: "lock.shield.fill"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.tintColor = ironVaultAccent
        icon.contentMode = .scaleAspectFit

        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.text = "Choose a credential"
        title.font = UIFont.systemFont(ofSize: 20, weight: .semibold)
        title.textColor = .white

        let subtitle = UILabel()
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        subtitle.text = subtitleText()
        subtitle.font = UIFont.systemFont(ofSize: 13, weight: .regular)
        subtitle.textColor = UIColor(white: 1, alpha: 0.55)
        subtitle.numberOfLines = 2

        searchBar.translatesAutoresizingMaskIntoConstraints = false
        searchBar.placeholder = "Search credentials"
        searchBar.searchBarStyle = .minimal
        searchBar.delegate = self
        searchBar.tintColor = ironVaultAccent
        searchBar.barStyle = .black
        searchBar.searchTextField.textColor = .white
        searchBar.searchTextField.backgroundColor = UIColor(white: 1, alpha: 0.08)
        searchBar.searchTextField.attributedPlaceholder = NSAttributedString(
            string: "Search credentials",
            attributes: [.foregroundColor: UIColor(white: 1, alpha: 0.45)]
        )

        header.addSubview(iconBg)
        iconBg.addSubview(icon)
        header.addSubview(title)
        header.addSubview(subtitle)
        header.addSubview(searchBar)

        NSLayoutConstraint.activate([
            iconBg.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 20),
            iconBg.topAnchor.constraint(equalTo: header.topAnchor, constant: 14),
            iconBg.widthAnchor.constraint(equalToConstant: 42),
            iconBg.heightAnchor.constraint(equalToConstant: 42),

            icon.centerXAnchor.constraint(equalTo: iconBg.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconBg.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 22),
            icon.heightAnchor.constraint(equalToConstant: 22),

            title.leadingAnchor.constraint(equalTo: iconBg.trailingAnchor, constant: 12),
            title.topAnchor.constraint(equalTo: header.topAnchor, constant: 16),
            title.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -20),

            subtitle.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 2),
            subtitle.trailingAnchor.constraint(equalTo: title.trailingAnchor),

            searchBar.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 12),
            searchBar.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -12),
            searchBar.topAnchor.constraint(equalTo: iconBg.bottomAnchor, constant: 12),
            searchBar.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -8),
            searchBar.heightAnchor.constraint(equalToConstant: 40),
        ])

        tableView.tableHeaderView = header
        header.widthAnchor.constraint(equalTo: tableView.widthAnchor).isActive = true
    }

    private func setupTable() {
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.separatorColor = UIColor(white: 1, alpha: 0.08)
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(CredentialCell.self, forCellReuseIdentifier: CredentialCell.reuseID)
        tableView.rowHeight = 64
        tableView.sectionHeaderTopPadding = 12
        view.addSubview(tableView)

        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.text = "No saved credentials"
        emptyLabel.textColor = UIColor(white: 1, alpha: 0.5)
        emptyLabel.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        emptyLabel.textAlignment = .center
        emptyLabel.isHidden = true
        view.addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    // MARK: Data

    private func applyFilter(_ query: String) {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty {
            filteredSuggested = suggested
            filteredAll = all.filter { c in !suggested.contains(c) }
        } else {
            let pred: (AutoFillCredential) -> Bool = { c in
                c.host.contains(q) || c.username.lowercased().contains(q) || c.url.lowercased().contains(q)
            }
            filteredSuggested = suggested.filter(pred)
            filteredAll = all.filter { c in !suggested.contains(c) && pred(c) }
        }
        emptyLabel.isHidden = !(filteredSuggested.isEmpty && filteredAll.isEmpty)
        tableView.reloadData()
    }

    private func subtitleText() -> String {
        if let label = serviceLabel, !label.isEmpty {
            return "Filling for \(label)"
        }
        return "Pick a saved login to autofill"
    }

    private var ironVaultAccent: UIColor {
        // IronVault brand teal — kept in sync with web tokens.
        UIColor(red: 0.21, green: 0.78, blue: 0.84, alpha: 1)
    }

    @objc private func cancelTapped() {
        delegate?.credentialListDidCancel(self)
    }
}

// MARK: - UITableViewDataSource / Delegate

extension CredentialListViewController: UITableViewDataSource, UITableViewDelegate {

    func numberOfSections(in tableView: UITableView) -> Int { Section.allCases.count }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        guard let s = Section(rawValue: section) else { return 0 }
        return s == .suggested ? filteredSuggested.count : filteredAll.count
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        guard let s = Section(rawValue: section) else { return nil }
        switch s {
        case .suggested:
            return filteredSuggested.isEmpty ? nil : "Suggested"
        case .all:
            return filteredAll.isEmpty ? nil : (filteredSuggested.isEmpty ? "All credentials" : "Other")
        }
    }

    func tableView(_ tableView: UITableView, willDisplayHeaderView view: UIView, forSection section: Int) {
        if let header = view as? UITableViewHeaderFooterView {
            header.textLabel?.textColor = UIColor(white: 1, alpha: 0.55)
            header.textLabel?.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        }
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: CredentialCell.reuseID, for: indexPath) as! CredentialCell
        let cred = credential(at: indexPath)
        cell.configure(with: cred)
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let cred = credential(at: indexPath)
        delegate?.credentialList(self, didSelect: cred)
    }

    private func credential(at indexPath: IndexPath) -> AutoFillCredential {
        guard let s = Section(rawValue: indexPath.section) else { return filteredAll[indexPath.row] }
        return s == .suggested ? filteredSuggested[indexPath.row] : filteredAll[indexPath.row]
    }
}

extension CredentialListViewController: UISearchBarDelegate {
    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        applyFilter(searchText)
    }

    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        searchBar.resignFirstResponder()
    }
}

// MARK: - Credential cell

final class CredentialCell: UITableViewCell {
    static let reuseID = "CredentialCell"

    private let avatar = UIView()
    private let avatarLabel = UILabel()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let chevron = UIImageView(image: UIImage(systemName: "chevron.right"))

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: .default, reuseIdentifier: reuseIdentifier)
        setup()
    }

    required init?(coder: NSCoder) { fatalError() }

    private func setup() {
        backgroundColor = UIColor(white: 1, alpha: 0.04)
        contentView.backgroundColor = .clear
        selectionStyle = .none

        let highlight = UIView()
        highlight.backgroundColor = UIColor(red: 0.21, green: 0.78, blue: 0.84, alpha: 0.12)
        selectedBackgroundView = highlight

        avatar.translatesAutoresizingMaskIntoConstraints = false
        avatar.backgroundColor = UIColor(red: 0.21, green: 0.78, blue: 0.84, alpha: 0.22)
        avatar.layer.cornerRadius = 18

        avatarLabel.translatesAutoresizingMaskIntoConstraints = false
        avatarLabel.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        avatarLabel.textColor = UIColor(red: 0.5, green: 0.93, blue: 0.97, alpha: 1)
        avatarLabel.textAlignment = .center

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        titleLabel.textColor = .white

        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = UIFont.systemFont(ofSize: 13, weight: .regular)
        subtitleLabel.textColor = UIColor(white: 1, alpha: 0.55)

        chevron.translatesAutoresizingMaskIntoConstraints = false
        chevron.tintColor = UIColor(white: 1, alpha: 0.35)
        chevron.contentMode = .scaleAspectFit

        contentView.addSubview(avatar)
        avatar.addSubview(avatarLabel)
        contentView.addSubview(titleLabel)
        contentView.addSubview(subtitleLabel)
        contentView.addSubview(chevron)

        NSLayoutConstraint.activate([
            avatar.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14),
            avatar.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            avatar.widthAnchor.constraint(equalToConstant: 36),
            avatar.heightAnchor.constraint(equalToConstant: 36),

            avatarLabel.centerXAnchor.constraint(equalTo: avatar.centerXAnchor),
            avatarLabel.centerYAnchor.constraint(equalTo: avatar.centerYAnchor),

            titleLabel.leadingAnchor.constraint(equalTo: avatar.trailingAnchor, constant: 12),
            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: chevron.leadingAnchor, constant: -8),

            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),

            chevron.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14),
            chevron.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            chevron.widthAnchor.constraint(equalToConstant: 8),
            chevron.heightAnchor.constraint(equalToConstant: 14),
        ])
    }

    func configure(with credential: AutoFillCredential) {
        avatarLabel.text = credential.initial
        titleLabel.text = credential.username.isEmpty ? "—" : credential.username
        subtitleLabel.text = credential.host
    }
}
