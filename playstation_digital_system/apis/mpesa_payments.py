import frappe
import requests
from frappe.utils.background_jobs import enqueue
from urllib.parse import urlencode

API_KEY = "30yfpG6ehrVs7D87Tc8kTt0Fu-T0EtjYToWEuX27"
BASE_URL = "https://tinypesa.com/api/v1"

@frappe.whitelist(allow_guest=True)
def pay_via_tinypesa(phone, amount, invoice_id=None):
    """
    Initiates an STK push via TinyPesa using form-urlencoded data.
    Must be called from frappe.call() inside the Frappe desk environment.
    """
    if not invoice_id:
        frappe.throw("Invoice ID is required as account_no (External Reference).")

    # Try normalizing phone number to "07XXXXXXXX"
    if phone.startswith('+254'):
        # Convert +2547XXXXXXXX to 07XXXXXXXX
        phone = '0' + phone[4:]  # e.g. +254712345678 -> 0712345678

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "ApiKey": API_KEY,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    }

    data = {
        'amount': amount,
        'msisdn': phone,
        'account_no': invoice_id
    }

    url = f"{BASE_URL}/express/initialize"
    encoded_data = urlencode(data)

    response = requests.post(url, headers=headers, data=encoded_data)

    if response.status_code == 200:
        resp = response.json()
        if resp.get('success') == 'true':
            request_id = resp.get('request_id')
            enqueue(
                "playstation_digital_system.apis.mpesa_payments.check_transaction_status",
                queue='short',
                job_name='check_tinypesa_transaction_status',
                account_no=invoice_id,
                now=False,
                timeout=300,
                delay=30
            )
            return f"STK Push Initiated with request_id: {request_id}"
        else:
            frappe.throw(f"Failed to initiate STK push: {resp}")
    else:
        # Log the raw response to see if TinyPesa returns more info
        frappe.throw(f"Failed to initiate STK push: {response.text}")

def check_transaction_status(account_no):
    headers = {
        "Accept": "application/json",
        "ApiKey": API_KEY,
        "User-Agent": "Mozilla/5.0"
    }

    url = f"{BASE_URL}/express/get_status/{account_no}/"
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        txn_info = response.json()
        if txn_info.get("is_complete") == 1:
            txn = frappe.get_doc({
                "doctype": "Mpesa Transactions",
                "transaction_id": txn_info.get("id"),
                "amount": txn_info.get("amount"),
                "msisdn": txn_info.get("msisdn"),
                "is_complete": txn_info.get("is_complete"),
                "sync_status": txn_info.get("sync_status"),
                "external_reference": txn_info.get("external_reference"),
                "mpesa_receipt": txn_info.get("mpesa_receipt"),
                "link_id": txn_info.get("link_id"),
                "created_at": txn_info.get("created_at")
            })
            txn.insert(ignore_permissions=True)
            txn.submit()

            frappe.publish_realtime(
                event="msgprint",
                message=f"Payment for {account_no} received and logged.",
                user=frappe.session.user if frappe.session.user else None
            )
        else:
            enqueue(
                "playstation_digital_system.apis.mpesa_payments.check_transaction_status",
                queue='short',
                job_name='check_tinypesa_transaction_status_retry',
                account_no=account_no,
                now=False,
                timeout=300,
                delay=30
            )
    else:
        enqueue(
            "playstation_digital_system.apis.mpesa_payments.check_transaction_status",
            queue='short',
            job_name='check_tinypesa_transaction_status_retry_notfound',
            account_no=account_no,
            now=False,
            timeout=300,
            delay=60
        )


