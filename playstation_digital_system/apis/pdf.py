import frappe
from frappe.utils.pdf import get_pdf

@frappe.whitelist()
def send_transaction_report(email, html_content, report_title):
    # Check for user permission
    if not frappe.has_permission("Caffe", "read"):
        frappe.throw("You do not have permission to perform this action.")

    # Generate PDF content
    try:
        pdf_data = get_pdf(html_content)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "PDF Generation Error")
        frappe.throw("Failed to generate PDF. Please check the HTML content.")

    # Ensure PDF content exists
    if not pdf_data or len(pdf_data) == 0:
        frappe.throw("PDF content is empty. Cannot attach the file to email.")

    # Send email with attachment
    try:
        frappe.sendmail(
            recipients=email,
            subject=f"Transaction Report: {report_title}",
            message="Please find attached the requested transaction report.",
            attachments=[
                {
                    "content": pdf_data,
                    "filename": f"{report_title}.pdf",
                    "type": "application/pdf"
                }
            ],
            now=True
        )
        return {"status": "success", "message": f"Email sent successfully to {email}."}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Email Sending Error")
        frappe.throw("Failed to send email. Please check the recipient email or server configuration.")
