from frappe.model.document import Document
import frappe
from frappe.utils import now_datetime, time_diff_in_seconds
import math

class GameSession(Document):
    pass

@frappe.whitelist()
def create_game_session(game_space_id, game_name):
    gs = frappe.get_value("Game Space", {"game_space_id": game_space_id}, "name")
    if not gs:
        frappe.throw("Game Space not found")

    game_doc = frappe.get_doc("Games", game_name)

    session = frappe.get_doc({
        "doctype": "Game Session",
        "game_space_selected": gs,
        "game_played": game_name,
        "created_by": frappe.session.user,
        "session_started_at": now_datetime()
    })
    session.insert(ignore_permissions=True)
    frappe.db.commit()

    item_name = f"{session.game_space_selected}/{game_doc.name_of_the_game}/{session.session_started_at.strftime('%d-%m-%Y %H:%M:%S')}"
    item = frappe.get_doc({
        "doctype": "Item",
        "item_code": session.name,
        "item_name": item_name,
        "item_group": "Services",
        "stock_uom": "Nos",
        "is_stock_item": 0
    })
    item.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "game_session_name": session.name,
        "game_space": game_space_id,
        "game_played": game_doc.name_of_the_game,
        "session_started_at": session.session_started_at.isoformat()
    }

@frappe.whitelist()
def terminate_game_session(game_space_id):
    game_space_names = frappe.db.get_values("Game Space", {"game_space_id": game_space_id}, "name")
    if not game_space_names:
        frappe.throw("Game Space not found.")

    session_name = frappe.db.get_value("Game Session", {
        "game_space_selected": ("in", game_space_names),
        "docstatus": 0
    }, "name")

    if not session_name:
        frappe.throw("Active Game Session not found for this Game Space")

    session = frappe.get_doc("Game Session", session_name)
    if session.docstatus == 1:
        frappe.throw("Game Session already submitted")

    # End the session
    session.session_ended_at = now_datetime()
    duration = time_diff_in_seconds(session.session_ended_at, session.session_started_at)
    session.duration = duration
    session.submit()

    # Create Sales Invoice and get its name
    si_name = create_sales_invoice_for_session(session.name)

    gs_name = session.game_space_selected
    frappe.db.set_value("Game Space", gs_name, "occupied", "Not Occupied")
    frappe.db.commit()

    return si_name

def create_sales_invoice_for_session(session_name):
    session = frappe.get_doc("Game Session", session_name)
    game_doc = frappe.get_doc("Games", session.game_played)
    item = frappe.get_doc("Item", session.name)

    duration_seconds = float(session.duration)
    minutes = duration_seconds / 60.0

    def ceil_increments(total_minutes, increment):
        return math.ceil(total_minutes / increment)

    pricing_rate = game_doc.pricing_rate
    if pricing_rate == "Pay Per Game Minutes":
        # 15-minute increments using game_pricing as the per-15-min block cost
        increment = 15
        increments = ceil_increments(minutes, increment)
        base_rate = game_doc.game_pricing
        base_amount = increments * base_rate

    elif pricing_rate == "Custom Pricing":
        # custom_duration increments, cost derived from rate_per_hour
        custom_dur = convert_duration_to_minutes(game_doc.custom_duration)
        increment = custom_dur
        increments = ceil_increments(minutes, increment)
        # cost per increment = (rate_per_hour/60)*increment
        cost_per_increment = (game_doc.rate_per_hour / 60.0) * increment
        base_rate = cost_per_increment
        base_amount = increments * base_rate

    elif pricing_rate == "Pay Per Hour":
        # Hourly increments
        increment = 60
        increments = ceil_increments(minutes, increment)
        base_rate = game_doc.rate_per_hour
        base_amount = increments * base_rate

    else:
        # Pay Per 15 Minutes: use rate_per_hour as the cost per 15-minute block directly
        increment = 15
        increments = ceil_increments(minutes, increment)
        # No division by 4 now. We assume rate_per_hour is actually per 15-min block.
        base_rate = game_doc.rate_per_hour
        base_amount = increments * base_rate

    si = frappe.get_doc({
        "doctype": "Sales Invoice",
        "customer": "Walkin",
        "company": frappe.defaults.get_global_default('company'),
        "posting_date": frappe.utils.today(),
        "posting_time": frappe.utils.nowtime(),
        "due_date": frappe.utils.today(),
        "items": [{
            "item_code": item.item_code,
            "item_name": item.item_name,
            "qty": 1,
            "rate": base_rate,
            "amount": base_amount
        }],
        "currency": frappe.defaults.get_global_default('currency') or "KES"
    })
    si.insert(ignore_permissions=True)
    si.submit()
    frappe.db.commit()

    return si.name

def convert_duration_to_minutes(duration_str):
    if "Hour" in duration_str:
        return 60
    if "Minutes" in duration_str:
        parts = duration_str.split()
        return float(parts[0])
    return 15.0
