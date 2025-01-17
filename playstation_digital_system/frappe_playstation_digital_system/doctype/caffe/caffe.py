# Copyright (c) 2024, John Kitheka and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class Caffe(Document):
    def on_update(self):
        """
        This method is called whenever a Caffe document is updated.
        It handles the display of the overshadowing dialog based on the
        custom_register_open field.
        """
        # Log the update action for debugging/auditing purposes
        frappe.log_error(
            title=f"Caffe '{self.name}' Updated",
            message=f"custom_register_open: {self.custom_register_open}\nTimestamp: {now_datetime()}"
        )
        
        if self.custom_register_open:
            pass  # Replace with actual logic if needed
        else:
            # Actions to perform when the register is closed
            pass  # Replace with actual logic if needed

@frappe.whitelist()
def terminate_session_for_space(game_space_id):
    # Import the terminate_game_session function from game_session.py
    from playstation_digital_system.frappe_playstation_digital_system.doctype.game_session.game_session import terminate_game_session
    terminate_game_session(game_space_id)
    return "OK"

# In your Caffe doctype Python file (e.g., caffe.py)

@frappe.whitelist()
def create_cash_payment_entry(sales_invoice, amount, game_space_id):
    # Logic to create and submit a Cash Payment Entry
    # Example:
    payment_entry = frappe.get_doc({
        "doctype": "Payment Entry",
        "payment_type": "Receive",
        "mode_of_payment": "Cash",
        "party_type": "Customer",
        "party": frappe.db.get_value("Sales Invoice", sales_invoice, "customer"),
        "received_amount": amount,
        "reference_doctype": "Sales Invoice",
        "reference_name": sales_invoice,
        "remarks": f"Cash Payment for Game Space {game_space_id}"
    })
    payment_entry.insert()
    payment_entry.submit()
    return payment_entry.name

@frappe.whitelist()
def create_mpesa_payment_entry(sales_invoice, phone_number, amount, game_space_id):
    # Logic to create and submit an Mpesa Payment Entry
    payment_entry = frappe.get_doc({
        "doctype": "Payment Entry",
        "payment_type": "Receive",
        "mode_of_payment": "Mpesa",
        "party_type": "Customer",
        "party": frappe.db.get_value("Sales Invoice", sales_invoice, "customer"),
        "received_amount": amount,
        "reference_doctype": "Sales Invoice",
        "reference_name": sales_invoice,
        "remarks": f"Mpesa Payment from {phone_number} for Game Space {game_space_id}"
    })
    payment_entry.insert()
    payment_entry.submit()
    return payment_entry.name

@frappe.whitelist()
def create_bank_payment_entry(sales_invoice, bank_name, amount, game_space_id):
    # Logic to create and submit a Bank Payment Entry
    payment_entry = frappe.get_doc({
        "doctype": "Payment Entry",
        "payment_type": "Receive",
        "mode_of_payment": "Bank",
        "party_type": "Customer",
        "party": frappe.db.get_value("Sales Invoice", sales_invoice, "customer"),
        "received_amount": amount,
        "reference_doctype": "Sales Invoice",
        "reference_name": sales_invoice,
        "remarks": f"Bank ({bank_name}) Payment for Game Space {game_space_id}"
    })
    payment_entry.insert()
    payment_entry.submit()
    return payment_entry.name

import frappe
from frappe.utils import now_datetime
import frappe
from frappe.utils import now_datetime

@frappe.whitelist()
def log_caffe_action(caffe_name, message):
    """Logs an action to the Caffe's custom_logs field."""
    try:
        caffe = frappe.get_doc("Caffe", caffe_name)
        timestamp = now_datetime().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        
        # Append the log entry to the existing logs
        if not caffe.custom_custom_logs:
            caffe.custom_custom_logs = log_entry
        else:
            caffe.custom_custom_logs = f"{caffe.custom_custom_logs}\n{log_entry}"
        
        caffe.save(ignore_permissions=True)  
        frappe.msgprint(f"Action logged: {message}", alert=True)
        return {"status": "success", "message": "Log updated successfully."}
    except Exception as e:
        error_message = f"Failed to log action in Caffe: {str(e)}"
        short_title = (error_message[:137] + "...") if len(error_message) > 140 else error_message

        # Log the truncated title in the Error Log and full content
        frappe.log_error(
            title=short_title,
            message=error_message
        )
        return {"status": "error", "message": f"Error logging action: {str(e)}"}
