# Copyright (c) 2024, John Kitheka and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from datetime import time, datetime
from frappe.utils import nowdate
from frappe.utils.pdf import get_pdf

class CaffeSettings(Document):
    def validate(self):
        # Validate automatic closing times if enabled
        self.validate_automatic_closure_times()

    def validate_automatic_closure_times(self):
        """
        If automatic_closing_of_register is checked, ensure that end_time is strictly after start_time.
        """
        if self.automatic_closing_of_register:
            if not self.start_time or not self.end_time:
                frappe.throw(_("Please set both Start Time and End Time when Automatic Closing of Register is enabled."))

            start = self._parse_time(str(self.start_time))
            end = self._parse_time(str(self.end_time))

            if end <= start:
                frappe.throw(_("End Time must be greater than Start Time for automatic closing."))

    def _parse_time(self, t_str):
        """
        Convert a time string HH:MM:SS into a time object.
        """
        parts = t_str.split(':')
        hour, minute = int(parts[0]), int(parts[1])
        second = int(parts[2]) if len(parts) > 2 else 0
        return time(hour, minute, second)

@frappe.whitelist()
def is_automatic_closure_enabled():
    """
    Check if automatic_closing_of_register is enabled.
    Returns True or False.
    """
    settings = frappe.get_single("Caffe Settings")
    return bool(settings.automatic_closing_of_register)

@frappe.whitelist()
def is_business_closed():
    """
    Determine if the café is currently considered closed based on Caffe Settings and current time.
    If automatic_closing_of_register is True, the business is considered closed if now is not within 
    the operational window (start_time <= now < end_time).
    If automatic_closing_of_register is False, return False (business is considered open).
    
    Returns:
        bool: True if business is closed, False otherwise.
    """
    settings = frappe.get_single("Caffe Settings")
    if not settings.automatic_closing_of_register:
        return False

    now = datetime.now().time()
    start = settings._parse_time(str(settings.start_time))
    end = settings._parse_time(str(settings.end_time))
    if now < start or now >= end:
        return True
    return False

def send_daily_sales_report():
    """
    Send a daily sales report email if auto_email_daily_sales_reports is enabled.
    If automatic_closing_of_register is True, send the report at end_time.
    Otherwise, send at midnight (00:00).

    This function should be triggered daily (for example, by a scheduled task).
    It will check conditions and send the email only if it's the correct time and the feature is enabled.
    """
    settings = frappe.get_single("Caffe Settings")
    if not settings.auto_email_daily_sales_reports:
        return  # Email not required

    # Determine if current time matches the sending criteria
    now = datetime.now()
    current_time = now.time()
    start = settings._parse_time(str(settings.start_time)) if settings.start_time else time(0, 0, 0)
    end = settings._parse_time(str(settings.end_time)) if settings.end_time else time(23, 59, 59)

    # If automatic_closing_of_register is True, we send the email at end_time
    # Otherwise, we send it at 00:00 (midnight)
    if settings.automatic_closing_of_register:
        # Check if current time is greater or equal to end_time (assuming daily run after end_time)
        if current_time < end:
            return  # It's not yet end_time, don't send
    else:
        # If not automatic, we assume midnight sending
        # Check if current time is between 00:00 and 00:05, for example, to allow a small window
        if not (current_time.hour == 0 and current_time.minute <= 10):
            return

    result = frappe.call("playstation_digital_system.apis.reports_api.get_todays_invoices_summary", date=nowdate())
    if not result:
        return

    total_unpaid = result.get('total_unpaid', 0)
    total_paid = result.get('total_paid', 0)
    total_expected = total_unpaid + total_paid

    # Construct the email subject and message
    subject = f"Daily Sales Report - {nowdate()}"
    message = f"""
    <h3>Daily Sales Report for {nowdate()}</h3>
    <p><b>Total Unpaid Sales Invoices:</b> {frappe.utils.fmt_money(total_unpaid)}</p>
    <p><b>Total Paid Sales Invoices:</b> {frappe.utils.fmt_money(total_paid)}</p>
    <p><b>Total Revenue Expected:</b> {frappe.utils.fmt_money(total_expected)}</p>
    <hr>
    <p>Below is a summary of all invoices for the day:</p>
    <table border="1" cellpadding="5" cellspacing="0">
        <tr><th>Invoice</th><th>Status</th><th>Grand Total</th><th>Date</th></tr>
        {''.join([f"<tr><td>{inv.get('name')}</td><td>{inv.get('status', 'N/A')}</td><td>{frappe.utils.fmt_money(inv.get('grand_total',0))}</td><td>{inv.get('posting_date','')}</td></tr>" for inv in result.get('invoices',[])])}
    </table>
    <p><i>This is an automated daily report.</i></p>
    """

    # Get the specific emails
    # Assume 'specific_emails' is a Data field containing comma-separated addresses.
    recipient_str = settings.specific_emails or ""
    recipients = [e.strip() for e in recipient_str.split(',') if e.strip()]

    if not recipients:
        # No recipients configured
        return
    frappe.sendmail(
        recipients=recipients,
        subject=subject,
        message=message,
        now=True
    )
    
from datetime import datetime, time

# def send_daily_sales_report():
#     settings = frappe.get_single("Caffe Settings")
#     if not settings.auto_email_daily_sales_reports:
#         return  # Email not required

#     # Hardcoded testing values (for actual code, you'd use datetime.now())
#     now_str = "15-12-2024"
#     current_time_str = "22:00:00"

#     # Parse current_time_str into a time object
#     current_time = datetime.strptime(current_time_str, "%H:%M:%S").time()

#     start = settings._parse_time(str(settings.start_time)) if settings.start_time else time(0, 0, 0)
#     end = settings._parse_time(str(settings.end_time)) if settings.end_time else time(23, 59, 59)

#     if settings.automatic_closing_of_register:
#         # Check if current time is greater or equal to end_time
#         # If current_time < end means it is before end_time, don't send the email yet.
#         if current_time < end:
#             return
#     else:
#         # Non-automatic scenario: send at midnight
#         # Here we assume the code runs and checks if current_time is close to midnight.
#         if not (current_time.hour == 0 and current_time.minute <= 10):
#             return

#     result = frappe.call("playstation_digital_system.apis.reports_api.get_todays_invoices_summary", date=nowdate())
#     if not result:
#         return

#     total_unpaid = result.get('total_unpaid', 0)
#     total_paid = result.get('total_paid', 0)
#     total_expected = total_unpaid + total_paid

#     subject = f"Daily Sales Report - {nowdate()}"
#     message = f"""
#     <h3>Daily Sales Report for {nowdate()}</h3>
#     <p><b>Total Unpaid Sales Invoices:</b> {frappe.utils.fmt_money(total_unpaid)}</p>
#     <p><b>Total Paid Sales Invoices:</b> {frappe.utils.fmt_money(total_paid)}</p>
#     <p><b>Total Revenue Expected:</b> {frappe.utils.fmt_money(total_expected)}</p>
#     <hr>
#     <p>Below is a summary of all invoices for the day:</p>
#     <table border="1" cellpadding="5" cellspacing="0">
#         <tr><th>Invoice</th><th>Status</th><th>Grand Total</th><th>Date</th></tr>
#         {''.join([f"<tr><td>{inv.get('name')}</td><td>{inv.get('status', 'N/A')}</td><td>{frappe.utils.fmt_money(inv.get('grand_total',0))}</td><td>{inv.get('posting_date','')}</td></tr>" for inv in result.get('invoices',[])])}
#     </table>
#     <p><i>This is an automated daily report.</i></p>
#     """

#     recipient_str = settings.specific_emails or ""
#     recipients = [e.strip() for e in recipient_str.split(',') if e.strip()]

#     if not recipients:
#         return

#     frappe.sendmail(
#         recipients=recipients,
#         subject=subject,
#         message=message,
#         now=True
#     )

from datetime import datetime, time
import frappe
from frappe.utils import nowdate

# def send_daily_session_logs_report():
#     settings = frappe.get_single("Caffe Settings")
#     if not settings.auto_email_daily_session_logs_reports:
#         return

#     # Hardcoded testing values (for actual code, you'd use datetime.now())
#     now_str = "15-12-2024"
#     current_time_str = "00:05:00"  # Simulate a time near midnight
#     current_time = datetime.strptime(current_time_str, "%H:%M:%S").time()

#     # For session logs, we always send at midnight (00:00 <= time <= 00:10)
#     # Check if current_time is between 00:00 and 00:10
#     if not (current_time.hour == 0 and current_time.minute <= 10):
#         return

#     # Get logs from Caffe doc
#     caffe_doc = frappe.get_single("Caffe")
#     logs = caffe_doc.custom_custom_logs or ""
#     if not logs.strip():
#         # No logs to send
#         return

#     # If logs are plain text, consider them as preformatted text in HTML
#     html_content = f"""
#     <html>
#     <head><title>Daily Session Logs - {nowdate()}</title></head>
#     <body>
#         <h3>Daily Session Logs for {nowdate()}</h3>
#         <div style="white-space: pre-wrap; font-family: monospace;">{frappe.utils.escape_html(logs)}</div>
#         <p><i>This is an automated daily session logs report.</i></p>
#     </body>
#     </html>
#     """

#     # Get recipients from specific_addresses
#     recipient_str = settings.specific_addresses or ""
#     recipients = [e.strip() for e in recipient_str.split(',') if e.strip()]

#     if not recipients:
#         return

#     subject = f"Daily Session Logs Report - {nowdate()}"

#     # Send email with the logs as HTML content in the message
#     frappe.sendmail(
#         recipients=recipients,
#         subject=subject,
#         message=html_content,
#         now=True
#     )

#     # Clear the logs after sending
#     caffe_doc.custom_custom_logs = ""
#     caffe_doc.save(ignore_permissions=True)


def send_daily_session_logs_report():
    """
    Send a daily session logs report if auto_email_daily_session_logs_reports is enabled.
    This report is dispatched at midnight every day.
    
    Instead of sending as a PDF attachment, send the logs directly as HTML content in the email body.
    After sending the email, clear custom_custom_logs in Caffe for the next day's logs.
    """
    settings = frappe.get_single("Caffe Settings")
    if not settings.auto_email_daily_session_logs_reports:
        return

    # This report should always go at midnight (00:00)
    now = datetime.now()
    current_time = now.time()

    # Check if current time is around midnight
    if not (current_time.hour == 0 and current_time.minute <= 10):
        return

    # Get logs from Caffe doc
    caffe_doc = frappe.get_single("Caffe")
    logs = caffe_doc.custom_custom_logs or ""

    if not logs.strip():
        # No logs to send
        return

    # If logs are plain text, consider them as preformatted text in HTML
    # If they are already HTML, you can directly insert them.
    html_content = f"""
    <html>
    <head><title>Daily Session Logs - {nowdate()}</title></head>
    <body>
        <h3>Daily Session Logs for {nowdate()}</h3>
        <div style="white-space: pre-wrap; font-family: monospace;">{frappe.utils.escape_html(logs)}</div>
        <p><i>This is an automated daily session logs report.</i></p>
    </body>
    </html>
    """

    # Get recipients from specific_addresses
    recipient_str = settings.specific_addresses or ""
    recipients = [e.strip() for e in recipient_str.split(',') if e.strip()]

    if not recipients:
        return

    subject = f"Daily Session Logs Report - {nowdate()}"

    # Send email with the logs as HTML content in the message
    frappe.sendmail(
        recipients=recipients,
        subject=subject,
        message=html_content,  
        bulk=True
    )

    # Clear the logs after sending
    caffe_doc.custom_custom_logs = ""
    caffe_doc.save(ignore_permissions=True)

