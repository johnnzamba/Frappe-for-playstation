# playstation_digital_system/api.py

import frappe
from frappe.utils import today, getdate
from frappe import _

@frappe.whitelist(allow_guest=True)
def get_todays_invoices_summary(date=None):
    """
    Retrieves a summary of today's Sales Invoices, categorized by payment status.
    
    Args:
        date (str, optional): The date for which to retrieve invoices in 'YYYY-MM-DD' format.
                              Defaults to today's date.
                              
    Returns:
        dict: A dictionary containing total unpaid, total paid, total expected revenue,
              and a list of invoices with their details.
    """
    try:
        if date:
            # Validate date by attempting to parse it
            try:
                getdate(date)  # Raises ValueError if invalid
            except ValueError:
                frappe.throw(_("Invalid date format. Please use 'YYYY-MM-DD'."), title=_("Validation Error"))
        else:
            # If no date provided, use today's date
            date = today()

        invoices = frappe.get_all(
            'Sales Invoice',
            filters={
                'posting_date': date,
                'docstatus': 1
            },
            fields=['name', 'posting_date', 'status', 'grand_total', 'outstanding_amount', 'customer', 'company', 'currency']
        )
        
        total_unpaid = 0
        total_paid = 0
        invoices_list = []
        
        for inv in invoices:
            if inv.status.lower() == 'paid':
                total_paid += inv.grand_total
            else:
                total_unpaid += inv.grand_total
            
            # Append invoice details to the list
            invoices_list.append({
                'name': inv.name,
                'posting_date': inv.posting_date,
                'status': inv.status,
                'grand_total': inv.grand_total,
                'outstanding_amount': inv.outstanding_amount,
                'customer': inv.customer,
                'company': inv.company,
                'currency': inv.currency
            })
        
        # Calculate total expected revenue
        total_expected = total_unpaid + total_paid
        
        response = {
            'date': date,
            'total_unpaid': total_unpaid,
            'total_paid': total_paid,
            'total_expected': total_expected,
            'invoices': invoices_list
        }
        
        return response
    
    except frappe.ValidationError as ve:
        frappe.log_error(message=str(ve), title='Validation Error in get_todays_invoices_summary')
        frappe.throw(str(ve), title=_("Validation Error"))
    
    except Exception as e:
        frappe.log_error(message=str(e), title='Error in get_todays_invoices_summary')
        frappe.throw(_("An unexpected error occurred while fetching invoices summary. Please try again later."), title=_("Error"))
