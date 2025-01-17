// Copyright (c) 2024, John Kitheka and contributors
// For license information, please see license.txt

frappe.ui.form.on('Games', {
    refresh: function(frm) {
        frm.trigger('set_fields_based_on_pricing_rate');
    },

    pricing_rate: function(frm) {
        frm.trigger('set_fields_based_on_pricing_rate');
    },

    set_fields_based_on_pricing_rate: function(frm) {
        frm.set_df_property('pricing_duration', 'hidden', 1);
        frm.set_df_property('custom_duration', 'hidden', 1);
        frm.set_df_property('game_pricing', 'hidden', 1);
        frm.set_df_property('rate_per_hour', 'hidden', 1);

        if (frm.doc.pricing_rate === "Pay Per Hour") {
            frm.set_value('pricing_duration', "1 Hour");
            frm.set_df_property('pricing_duration', 'hidden', 0);
            frm.set_df_property('custom_duration', 'hidden', 1);
            frm.set_df_property('game_pricing', 'hidden', 1);
            frm.set_df_property('rate_per_hour', 'hidden', 0); 

        } else if (frm.doc.pricing_rate === "Pay Per 15 Minutes") {
            frm.set_value('pricing_duration', "15 Minutes");
            frm.set_df_property('pricing_duration', 'hidden', 0);
            frm.set_df_property('custom_duration', 'hidden', 1);
            frm.set_df_property('game_pricing', 'hidden', 1);
            frm.set_df_property('rate_per_hour', 'hidden', 0);

        } else if (frm.doc.pricing_rate === "Custom Pricing") {
            frm.set_value('pricing_duration', "Custom");
            frm.set_df_property('pricing_duration', 'hidden', 0);
            frm.set_df_property('custom_duration', 'hidden', 0);
            frm.set_df_property('game_pricing', 'hidden', 0);
            frm.set_df_property('rate_per_hour', 'hidden', 1);

        } else if (frm.doc.pricing_rate === "Pay Per Game Minutes") {
            frm.set_value('pricing_duration', "");
            frm.set_df_property('game_pricing', 'hidden', 0);
            frm.set_df_property('custom_duration', 'hidden', 1);
            frm.set_df_property('pricing_duration', 'hidden', 1);
            frm.set_df_property('rate_per_hour', 'hidden', 1);
        }
    }
});
