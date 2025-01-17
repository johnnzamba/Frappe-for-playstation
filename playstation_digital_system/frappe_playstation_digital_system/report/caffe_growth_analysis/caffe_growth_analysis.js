// Copyright (c) 2024, John Kitheka and contributors
// For license information, please see license.txt
frappe.query_reports["Caffe Growth Analysis"] = {
    "filters": [
        {
            "fieldname": "period",
            "label": "Period",
            "fieldtype": "Select",
            "options": [
                {"label": "Today", "value": "Today"},
                {"label": "Yesterday", "value": "Yesterday"},
                {"label": "3 Days ago", "value": "3_days_ago"},
                {"label": "1 Week Ago", "value": "1_week_ago"},
                {"label": "2 Weeks Ago", "value": "2_weeks_ago"},
                {"label": "1 Month ago", "value": "1_month_ago"}
            ],
            "default": "Today",
            "reqd": 1
        }
    ],

    onload_post_render: function(report) {
        // Ensure all async rendering is done
        frappe.after_ajax(() => {
            let period_filter = report.get_filter("period");
            if (period_filter) {
                // Find the control input wrapper of the period filter
                let $control_input = period_filter.$wrapper.find('.control-input');
                if ($control_input.length) {
                    // Create a small button next to the filter
                    let $btn = $('<button class="btn btn-sm btn-secondary" style="margin-left:5px;">' 
                                 + __('View Weekly Analysis') + '</button>');
                    $control_input.append($btn);

                    // On button click, fetch additional analysis
                    $btn.on('click', function() {
                        frappe.call({
                            method: 'playstation_digital_system.frappe_playstation_digital_system.report.caffe_growth_analysis.caffe_growth_analysis.get_additional_analysis',
                            callback: function(r) {
                                if (r.message) {
                                    let data = r.message;
                                    let msg = `
                                        <h4>${__("Weekly Glance Report")}</h4>
                                        <p>${data.message}</p>
                                        <p><b>${__("Most Played Game")}:</b> ${data.most_played_game}</p>
                                        <p><b>${__("Customer Activity Rate")}:</b> ${data.activity_rate.toFixed(2)}%</p>
                                        <p><b>${__("Most Frequented Day")}:</b> ${data.most_frequented_day}</p>
                                        <p><b>${__("Daily Growth")}:</b> ${data.daily_growth.toFixed(2)}%</p>
                                        <p><b>${__("Weekly Growth")}:</b> ${data.weekly_growth.toFixed(2)}%</p>
                                        <p><b>${__("Monthly Growth")}:</b> ${data.monthly_growth.toFixed(2)}%</p>
                                    `;
                                    let d = new frappe.ui.Dialog({
                                        title: __('Weekly Analysis'),
                                        primary_action_label: 'Close',
                                        primary_action: () => d.hide(),
                                        fields: [
                                            {
                                                fieldtype: 'HTML',
                                                fieldname: 'stats_html',
                                                options: msg
                                            },
                                            {
                                                fieldtype: 'HTML',
                                                fieldname: 'chart_area'
                                            }
                                        ]
                                    });
                                    d.show();

                                    // If line_chart data is present, render it inside the dialog
                                    if (data.line_chart) {
                                        let chart_container = d.get_field('chart_area').$wrapper;
                                        chart_container.append('<h4>Weekly Activity Trend</h4>');
                                        new frappe.Chart(chart_container[0], data.line_chart);
                                    }
                                }
                            }
                        });
                    });
                }
            }
        });
    }
};
