import frappe
from frappe import _

@frappe.whitelist(allow_guest=True)
def get_custom_accounts(company=None):
    """
    Fetches necessary account IDs for journal entries.
    """
    accounts = {}
    try:
        def_company = frappe.db.get_single_value('Global Defaults', 'default_company')
        if not company:
            company = def_company
        if not company:
            frappe.throw(_('Default Company not set in Global Defaults.'))

        # Fetch the company document and abbreviation
        company_doc = frappe.get_doc("Company", company)
        company_abbr = company_doc.abbr

        account_names = {
            "sales": "Sales",
            "debtors": "Debtors",
            "electricity_revenue": "Electricity Revenue",
            "water_revenue": "Water Revenue",
            "security_deposits": "Security Deposits",
            "rent_received": "Rent Received",
            "vat": "VAT",
            "mpesa": "Mpesa",
            "cash": "Cash",
            "bank_account": "Bank Account"
        }

        for key, account_name in account_names.items():
            full_account_name = f"{account_name} - {company_abbr}"
            account = frappe.get_value("Account", {
                "name": full_account_name,
                "company": company,
                "is_group": 0
            }, "name")

            if not account:
                frappe.throw(f"Account '{full_account_name}' not found for company '{company}'. Please create it in the Chart of Accounts.")

            accounts[key] = account

        return accounts

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error Fetching Custom Accounts")
        frappe.throw(_('An error occurred while fetching accounts: {0}').format(str(e)))
