// Copyright (c) 2024, John Kitheka and contributors
// For license information, please see license.txt

// game_space.js

frappe.ui.form.on('Game Space', {
    refresh: function(frm) {
        frm.trigger('set_occupancy_indicator');
    },
    occupied: function(frm) {
        frm.trigger('set_occupancy_indicator');
    },
    set_occupancy_indicator: function(frm) {
        let label, color;
        if (frm.doc.occupied === "Occupied") {
            label = "Occupied";
            color = "green";
        } else {
            label = "Not Occupied";
            color = "red";
        }

        // This overrides the default indicator (such as "Submitted")
        frm.page.set_indicator(label, color);
    }
});

