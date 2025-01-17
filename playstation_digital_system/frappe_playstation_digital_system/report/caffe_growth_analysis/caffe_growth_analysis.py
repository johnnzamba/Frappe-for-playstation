from __future__ import unicode_literals
import frappe
from frappe import _
from datetime import timedelta
from frappe.utils import nowdate, getdate

def execute(filters=None):
    if not filters:
        filters = {}

    start_date, end_date = get_date_range(filters.get("period"))
    data = get_data(start_date, end_date)
    columns = get_columns()

    # Compute totals
    total_grand = sum(d['grand_total'] for d in data if d.get('grand_total'))
    total_paid = sum(d['paid_amount'] for d in data if d.get('paid_amount'))

    # Add a totals row at the end
    if data:
        data.append({
            "sales_invoice": "Totals",
            "grand_total": total_grand,
            "outstanding_amount": "",
            "posting_date": "",
            "payment_entry": "",
            "paid_amount": total_paid
        })

    # Construct primary chart data (Bar comparing Grand Total vs Paid Amount)
    chart = get_bar_chart_data(total_grand, total_paid)

    return columns, data, None, chart

def get_columns():
    return [
        {
            "label": _("Sales Invoice"),
            "fieldname": "sales_invoice",
            "fieldtype": "Link",
            "options": "Sales Invoice",
            "width": 250
        },
        {
            "label": _("Grand Total"),
            "fieldname": "grand_total",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Outstanding Amount"),
            "fieldname": "outstanding_amount",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Posting Date"),
            "fieldname": "posting_date",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("Payment Entry"),
            "fieldname": "payment_entry",
            "fieldtype": "Link",
            "options": "Payment Entry",
            "width": 250
        },
        {
            "label": _("Paid Amount"),
            "fieldname": "paid_amount",
            "fieldtype": "Currency",
            "width": 120
        }
    ]

def get_date_range(period):
    today = getdate(nowdate())
    if period == "Today":
        start_date = today
        end_date = today
    elif period == "Yesterday":
        start_date = today - timedelta(days=1)
        end_date = today
    elif period == "3_days_ago":
        start_date = today - timedelta(days=3)
        end_date = today
    elif period == "1_week_ago":
        start_date = today - timedelta(days=7)
        end_date = today
    elif period == "2_weeks_ago":
        start_date = today - timedelta(days=14)
        end_date = today
    elif period == "1_month_ago":
        start_date = today - timedelta(days=30)
        end_date = today
    else:
        start_date = today
        end_date = today
    return start_date, end_date

def get_data(start_date, end_date):
    query = """
        SELECT
            si.name as sales_invoice,
            si.grand_total,
            si.outstanding_amount,
            si.posting_date,
            pe.name as payment_entry,
            per.allocated_amount as paid_amount
        FROM
            `tabSales Invoice` si
        LEFT JOIN `tabPayment Entry Reference` per 
            ON per.reference_name = si.name AND per.reference_doctype = 'Sales Invoice'
        LEFT JOIN `tabPayment Entry` pe 
            ON pe.name = per.parent
        WHERE
            si.docstatus = 1
            AND si.customer = 'Walkin'
            AND si.posting_date BETWEEN %(start_date)s AND %(end_date)s
        ORDER BY si.posting_date ASC, si.name ASC
    """

    data = frappe.db.sql(query, {
        "start_date": start_date,
        "end_date": end_date
    }, as_dict=True)
    return data

def get_bar_chart_data(total_grand, total_paid):
    chart = {
        "data": {
            "labels": ["Totals"],
            "datasets": [
                {
                    "name": "Grand Total",
                    "values": [total_grand],
                    "color": "#3e1bcc"
                },
                {
                    "name": "Paid Amount",
                    "values": [total_paid],
                    "color": "#FF6F00"
                }
            ]
        },
        "type": "bar",
        "title": _("Caffe Growth Analysis"),
        "height": 200
    }
    return chart

@frappe.whitelist()
def get_additional_analysis():
    today = getdate(nowdate())
    one_week_ago = today - timedelta(days=7)

    # 1. Most Played Game
    game_sessions = frappe.db.sql("""
        SELECT game_played, COUNT(*) as count
        FROM `tabGame Session`
        WHERE session_started_at >= %(start)s AND session_started_at <= %(end)s
        GROUP BY game_played
        ORDER BY count DESC
        LIMIT 1
    """, {"start": one_week_ago, "end": today}, as_dict=True)

    if game_sessions:
        most_played_game_id = game_sessions[0].game_played
        game_name = frappe.db.get_value("Games", {"name": most_played_game_id}, "name_of_the_game")
        most_played_game = game_name or most_played_game_id
    else:
        most_played_game = "No Sessions"

    # 2. Customer Activity Rate
    # Assume 'duration' is in hours. If 'duration' is in minutes, divide by 60.
    total_duration = frappe.db.sql("""
        SELECT SUM(duration) as total
        FROM `tabGame Session`
        WHERE session_started_at >= %(start)s AND session_started_at <= %(end)s
    """, {"start": one_week_ago, "end": today}, as_dict=True)[0].total or 0.0

    # Count ALL game spaces for stable capacity baseline
    total_game_spaces = frappe.db.count("Game Space")

    # If no game spaces at all, activity rate = 0
    if total_game_spaces == 0:
        activity_rate = 0.0
    else:
        total_hours_week = total_game_spaces * 24 * 7
        # Prevent unrealistic large numbers: If total_duration > total_hours_week * #spaces, check logic of 'duration'
        activity_rate = ((total_duration/60) / total_hours_week) * 100 if total_hours_week else 0.0

    # 3. Most Frequented Day (past week)
    frequented_day = frappe.db.sql("""
        SELECT DATE(session_started_at) as sdate, SUM(duration) as total_dur
        FROM `tabGame Session`
        WHERE session_started_at >= %(start)s AND session_started_at <= %(end)s
        GROUP BY DATE(session_started_at)
        ORDER BY total_dur DESC
        LIMIT 1
    """, {"start": one_week_ago, "end": today}, as_dict=True)
    most_frequented_day = frequented_day[0].sdate if frequented_day else "N/A"

    # 4. Percentage Growth (Daily, Weekly, Monthly)
    # Redefine growth calculations to be more stable:
    # daily_growth: compare today's revenue vs yesterday
    # weekly_growth: last 7 days vs previous 7 days
    # monthly_growth: last 30 days vs previous 30 days
    daily_growth = compute_period_growth(days=1)
    weekly_growth = compute_period_growth(days=7)
    monthly_growth = compute_period_growth(days=30)

    # 5. Line Chart: daily cumulative activity
    daily_activity = frappe.db.sql("""
        SELECT DATE(session_started_at) as sdate, SUM(duration) as total_dur
        FROM `tabGame Session`
        WHERE session_started_at >= %(start)s AND session_started_at <= %(end)s
        GROUP BY DATE(session_started_at)
        ORDER BY sdate ASC
    """, {"start": one_week_ago, "end": today}, as_dict=True)

    labels = []
    values = []
    for i in range(7):
        d = one_week_ago + timedelta(days=i)
        day_data = next((x for x in daily_activity if x.sdate == d), None)
        values.append(day_data.total_dur if day_data else 0)
        labels.append(d.strftime("%Y-%m-%d"))

    line_chart = {
        "data": {
            "labels": labels,
            "datasets": [{
                "name": "Daily Activity (hrs)",
                "values": values,
                "color": "#1abc9c"
            }]
        },
        "type": "line",
        "title": _("Weekly Activity Trend"),
        "height": 200
    }

    return {
        "most_played_game": most_played_game,
        "activity_rate": activity_rate,
        "most_frequented_day": most_frequented_day,
        "daily_growth": daily_growth,
        "weekly_growth": weekly_growth,
        "monthly_growth": monthly_growth,
        "line_chart": line_chart,
        "message": "This is a glance report computed for the past week."
    }

def compute_period_growth(days=1):
    """Compute revenue growth for a stable period:
    For daily growth: compare today's revenue vs yesterday.
    For weekly growth: sum of last 7 days vs previous 7 days.
    For monthly growth: sum of last 30 days vs previous 30 days.
    """
    today = getdate(nowdate())
    current_start = today - timedelta(days=days)
    # For stable comparison:
    current_total = get_revenue_sum(current_start, today)
    previous_total = get_revenue_sum(current_start - timedelta(days=days), current_start)

    if previous_total == 0:
        return 100.0 if current_total > 0 else 0.0
    else:
        return ((current_total - previous_total) / previous_total) * 100

def get_revenue_sum(start_date, end_date):
    res = frappe.db.sql("""
        SELECT SUM(grand_total) as total
        FROM `tabSales Invoice`
        WHERE docstatus=1 AND customer='Walkin'
        AND posting_date BETWEEN %(start)s AND %(end)s
    """, {"start": start_date, "end": end_date}, as_dict=True)
    return res[0].total or 0
