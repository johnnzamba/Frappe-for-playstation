// Copyright (c) 2024, John Kitheka and contributors
// For license information, please see license.txt

frappe.ui.form.on("Caffe Settings", {
    refresh(frm) {
        // Toggle start_time and end_time based on automatic_closing_of_register
        frm.toggle_display("start_time", frm.doc.automatic_closing_of_register);
        frm.toggle_display("end_time", frm.doc.automatic_closing_of_register);

        // Toggle specific_emails based on auto_email_daily_sales_reports
        frm.toggle_display("specific_emails", frm.doc.auto_email_daily_sales_reports);

        // Toggle specific_addresses based on auto_email_daily_session_logs_reports
        frm.toggle_display("specific_addresses", frm.doc.auto_email_daily_session_logs_reports);

        // Toggle sms_instructions based on integrate_sms_for_promo_services
        frm.toggle_display("sms_instructions", frm.doc.integrate_sms_for_promo_services);
    },

    automatic_closing_of_register(frm) {
        frm.toggle_display("start_time", frm.doc.automatic_closing_of_register);
        frm.toggle_display("end_time", frm.doc.automatic_closing_of_register);
    },

    auto_email_daily_sales_reports(frm) {
        frm.toggle_display("specific_emails", frm.doc.auto_email_daily_sales_reports);
    },

    auto_email_daily_session_logs_reports(frm) {
        frm.toggle_display("specific_addresses", frm.doc.auto_email_daily_session_logs_reports);
    },

    integrate_sms_for_promo_services(frm) {
        frm.toggle_display("sms_instructions", frm.doc.integrate_sms_for_promo_services);
    }
});
