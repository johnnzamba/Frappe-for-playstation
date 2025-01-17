import frappe
import json
from frappe.utils import flt, nowdate
from datetime import datetime
import traceback

def convert_transtime_format(trans_time):
    """
    Convert transaction time from 'YYYYMMDDHHMMSS' to 'YYYY-MM-DD HH:MM:SS' format.
    """
    try:
        return datetime.strptime(trans_time, "%Y%m%d%H%M%S").strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        frappe.throw(_("Invalid transaction time format."))

@frappe.whitelist(allow_guest=True)
def confirm_mpesa():
    """
    Handle Mpesa payment confirmation:
    1. Allocate payment to Sales Invoices based on exact match or FIFO.
    2. Create Payment Entries accordingly.
    3. Log the transaction.
    4. Send email notifications to customers.
    """
        # Parse incoming JSON data
        data = frappe.request.data
        data_dict = json.loads(data)
        frappe.set_user('Administrator')  # Ensure operations run with Admin privileges
        
        # Extract and format transaction details
        trans_time_formatted = convert_transtime_format(data_dict.get("TransTime"))
        trans_amount = flt(data_dict.get("TransAmount"))
        bill_ref_number = data_dict.get("BillRefNumber")
        trans_id = data_dict.get("TransID")
        msisdn = data_dict.get("MSISDN")
        first_name = data_dict.get("FirstName")
        middle_name = data_dict.get("MiddleName")
        last_name = data_dict.get("LastName")
        transaction_type = data_dict.get("TransactionType")
        business_shortcode = data_dict.get("BusinessShortCode")
        
        # Initialize response components
        payment_entries_created = []
        error_messages = []
        allocated_amount = trans_amount
        
        # Step 1: Exact Match Allocation
        if bill_ref_number:
            exact_match_invoice = frappe.get_all(
                "Sales Invoice",
                filters={
                    "name": bill_ref_number,
                    "status": ["!=", "Paid"],
                    "outstanding_amount": trans_amount
                },
                fields=["name", "company", "customer", "outstanding_amount", "grand_total"],
                limit=1
            )
            
            if exact_match_invoice:
                invoice = exact_match_invoice[0]
                try:
                    # Create Payment Entry for exact match
                    payment_entry = create_payment_entry(
                        company=invoice.company,
                        customer=invoice.customer,
                        paid_amount=trans_amount,
                        sales_invoice_name=invoice.name,
                        trans_id=trans_id,
                        mode_of_payment="Mpesa"
                    )
                    payment_entry.submit()
                    frappe.db.commit()
                    payment_entries_created.append(payment_entry.name)
                    allocated_amount -= trans_amount
                except Exception as e:
                    msg = f"Failed to create Payment Entry for Sales Invoice {invoice.name}: {e}"
                    frappe.logger().error(msg)
                    frappe.logger().error(traceback.format_exc())
                    error_messages.append(msg)
        
        # Step 2: FIFO Allocation for Remaining Amount
        if allocated_amount > 0:
            # Fetch unpaid Sales Invoices ordered by creation date (FIFO)
            unpaid_invoices = frappe.get_all(
                "Sales Invoice",
                filters={"status": ["!=", "Paid"]},
                fields=["name", "company", "customer", "outstanding_amount", "grand_total"],
                order_by="creation ASC"
            )
            
            # If an exact match was attempted with BillRefNumber, exclude it from FIFO allocation
            if bill_ref_number:
                unpaid_invoices = [inv for inv in unpaid_invoices if inv.name != bill_ref_number]
            
            for invoice in unpaid_invoices:
                if allocated_amount <= 0:
                    break
                outstanding = flt(invoice.outstanding_amount, 2)
                if outstanding <= 0:
                    continue
                allocation = min(outstanding, allocated_amount)
                try:
                    # Create Payment Entry for FIFO allocation
                    payment_entry = create_payment_entry(
                        company=invoice.company,
                        customer=invoice.customer,
                        paid_amount=allocation,
                        sales_invoice_name=invoice.name,
                        trans_id=trans_id,
                        mode_of_payment="Mpesa"
                    )
                    payment_entry.submit()
                    frappe.db.commit()
                    payment_entries_created.append(payment_entry.name)
                    allocated_amount -= allocation
                except Exception as e:
                    msg = f"Failed to create Payment Entry for Sales Invoice {invoice.name}: {e}"
                    frappe.logger().error(msg)
                    frappe.logger().error(traceback.format_exc())
                    error_messages.append(msg)
        
        if allocated_amount > 0:
            msg = f"Payment amount of {trans_amount} was not fully allocated. Remaining amount: {allocated_amount}"
            frappe.logger().warning(msg)
            error_messages.append(msg)
            # Optionally, handle the remaining amount (e.g., create an unallocated Payment Entry)
        
        # Step 3: Log the Transaction in Mpesa Transactions
        try:
            transaction_doc = frappe.get_doc({
                'doctype': 'Mpesa Transactions',
                'transid': trans_id,
                'transtime': trans_time_formatted,
                'transamount': trans_amount,
                'billrefnumber': bill_ref_number,
                'msisdn': msisdn,
                'outstanding_balance': allocated_amount,
                'as_at': nowdate()
            })
            transaction_doc.insert(ignore_permissions=True)
        except Exception as e:
            msg = f"Failed to create Mpesa Transactions document: {e}"
            frappe.logger().error(msg)
            frappe.logger().error(traceback.format_exc())
            error_messages.append(msg)
        
        # Step 4: Send Email Notifications for Each Payment Entry
        for pe_name in payment_entries_created:
            try:
                payment_entry_doc = frappe.get_doc("Payment Entry", pe_name)
                # Fetch customer's email from Customer doctype
                customer_email = frappe.db.get_value("Customer", payment_entry_doc.party, "email_id")
                customer_full_name = frappe.db.get_value("Customer", payment_entry_doc.party, "customer_name")
                
                if not customer_email:
                    frappe.logger().warning(f"No email found for Customer {payment_entry_doc.party}. Skipping email notification.")
                    continue  # Skip email if no customer email is found
                
                send_payment_email(
                    user_email=customer_email,
                    user_full_name=customer_full_name,
                    bill_ref_number=payment_entry_doc.references[0].reference_name,
                    cheque_no=payment_entry_doc.reference_no,
                    payment_id=pe_name
                )
            except Exception as e:
                msg = f"Failed to send payment email for Payment Entry {pe_name}: {e}"
                frappe.logger().error(msg)
                frappe.logger().error(traceback.format_exc())
                error_messages.append(msg)
        
        frappe.db.commit()
        
        # Restore user to 'Guest'
        frappe.set_user('Guest')
        
        # Prepare the response
        response = {
            'ResultCode': 0,
            'ResultDesc': 'Transaction successfully processed',
            'PaymentEntriesCreated': payment_entries_created,
            'Errors': error_messages
        }
        return json.dumps(response)
    
def create_payment_entry(company, customer, paid_amount, sales_invoice_name, trans_id, mode_of_payment):
        """
        Helper function to create a Payment Entry against a specific Sales Invoice.
        
        Args:
            company (str): Company name.
            customer (str): Customer name.
            paid_amount (float): Amount paid.
            sales_invoice_name (str): Name of the Sales Invoice.
            trans_id (str): Transaction ID from Mpesa.
            mode_of_payment (str): Mode of payment (e.g., "Mpesa").
        
        Returns:
            frappe.Document: The created Payment Entry document.
        """
        payment_entry = frappe.new_doc("Payment Entry")
        payment_entry.payment_type = "Receive"
        payment_entry.company = company
        payment_entry.posting_date = nowdate()
        payment_entry.mode_of_payment = mode_of_payment
        payment_entry.party_type = "Customer"
        payment_entry.party = customer
        payment_entry.paid_from = "Bank - RH"  # Update as per your configuration
        payment_entry.paid_to = "Mpesa Account - RH"  # Update as per your configuration
        payment_entry.paid_amount = paid_amount
        payment_entry.received_amount = paid_amount
        payment_entry.reference_no = trans_id
        payment_entry.reference_date = nowdate()
        
        # Append the Sales Invoice reference with allocated amount
        payment_entry.append("references", {
            "reference_doctype": "Sales Invoice",
            "reference_name": sales_invoice_name,
            "total_amount": frappe.db.get_value("Sales Invoice", sales_invoice_name, "grand_total"),
            "outstanding_amount": frappe.db.get_value("Sales Invoice", sales_invoice_name, "outstanding_amount"),
            "allocated_amount": paid_amount,
        })
        
        payment_entry.insert(ignore_permissions=True)
        return payment_entry
    
def send_payment_email(user_email, user_full_name, bill_ref_number, cheque_no, payment_id):
        """
        Send payment confirmation email after Payment Entry is created, with PDF attachment of the Payment Entry.
        
        Args:
            user_email (str): Recipient's email address.
            user_full_name (str): Recipient's full name.
            bill_ref_number (str): Reference number of the bill (Sales Invoice).
            cheque_no (str): Transaction ID.
            payment_id (str): Name of the Payment Entry.
        """
        subject = f"Payment Received for Invoice No: {bill_ref_number}"
        message = f"""
            Hello <strong>{user_full_name}</strong>,
            <br><br>
            We have received your payment Reference No. <strong>{cheque_no}</strong> made on <strong>{nowdate()}</strong>.
            <br>
            Find attached the Payment Receipt No. <strong>{payment_id}</strong> for your records.
            <br><br>
            Thank you for your business!
        """
        recipients = [user_email]
    
        try:
            # Generate PDF for Payment Entry
            pdf_data = frappe.get_print(
                doctype="Payment Entry",
                name=payment_id,
                print_format="Default",
                as_pdf=True
            )
    
            attachment = {
                'fname': f'Payment_{payment_id}.pdf',
                'fcontent': pdf_data
            }
    
            frappe.sendmail(
                recipients=recipients,
                subject=subject,
                message=message,
                attachments=[attachment],
                now=True
            )
    
            frappe.logger().info(f"Payment email sent to {user_email} with Payment Entry {payment_id} attached.")
    
        except Exception as e:
            frappe.log_error(f"Error sending payment email: {str(e)}")
            frappe.throw(_("Failed to send payment confirmation email."))
    
@frappe.whitelist()
def get_payment_history(invoice_id):
        """
        Fetch payment history from Payment Entries based on Sales Invoice ID.
        
        Args:
            invoice_id (str): Name of the Sales Invoice.
        
        Returns:
            dict: Structured response containing payment history.
        """
        try:
            # Fetch Payment Entries linked to the Sales Invoice
            payment_entries = frappe.get_all(
                "Payment Entry Reference",
                filters={"reference_name": invoice_id, "reference_doctype": "Sales Invoice"},
                fields=["parent"],
                order_by="parent.posting_date desc"
            )
            
            structured_response = []
            for pe_ref in payment_entries:
                payment_entry = frappe.get_doc("Payment Entry", pe_ref.parent)
                customer = frappe.db.get_value("Sales Invoice", invoice_id, "customer")
                customer_email = frappe.db.get_value("Customer", customer, "email_id") or ""
                customer_full_name = frappe.db.get_value("Customer", customer, "customer_name")
                
                structured_response.append({
                    "Invoice No": payment_entry.references[0].reference_name,
                    "Transaction ID": payment_entry.reference_no,
                    "Transaction Time": payment_entry.posting_date.strftime("%Y-%m-%d %H:%M:%S") if payment_entry.posting_date else None,
                    "Transaction Amount": payment_entry.paid_amount,
                    "Paid from Phone Number": payment_entry.paid_from,
                    "Outstanding Balance": flt(payment_entry.references[0].outstanding_amount - payment_entry.references[0].allocated_amount, 2),
                    "As at": payment_entry.posting_date.strftime("%Y-%m-%d %H:%M:%S") if payment_entry.posting_date else None
                })
            
            # Sort the structured response by "As at" in descending order
            structured_response = sorted(structured_response, key=lambda x: x["As at"], reverse=True)
    
            return {
                "ResultCode": 0,
                "ResultDesc": "Payment history fetched successfully, based on the Latest As at date",
                "Data": structured_response
            }
        
        except Exception as e:
            frappe.log_error(f"Error fetching payment history: {str(e)}")
            return {
                "ResultCode": 1,
                "ResultDesc": _("Error: {0}").format(str(e))
            }
