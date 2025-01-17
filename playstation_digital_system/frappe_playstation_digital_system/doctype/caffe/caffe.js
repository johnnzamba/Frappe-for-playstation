// Copyright (c) 2024, John Kitheka and contributors
// For license information, please see license.txt

frappe.ui.form.on('Caffe', {
    refresh: function(frm) {
        frm.trigger('load_floor_plan');
        frm.trigger('check_active_session_timers');
        frm.add_custom_button(__('Initiate Payment'), function() {
            showPaymentModeDialog()
        }).css({
            "color": "white", 
            "background-color": "#14141f", 
            "font-weight": "600"
        });
        frm.add_custom_button(__('View Transactions💰'), function() {
            showTransactionsDialog();
        }).css({
            "color": "white", 
            "background-color": "#14141f", 
            "font-weight": "600"
        });
        frm.add_custom_button(__('Close Register📥'), function() {
            handleCloseRegister(frm);
        }).css({
            "color": "white", 
            "background-color": "#14141f", 
            "font-weight": "600"
        });
        frm.add_custom_button(__('View Weekly Analysis'), function() {
            frappe.call({
                method: 'playstation_digital_system.frappe_playstation_digital_system.report.caffe_growth_analysis.caffe_growth_analysis.get_additional_analysis',
                callback: function(r) {
                    if(r.message) {
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

                        if (data.line_chart) {
                            let chart_container = d.get_field('chart_area').$wrapper;
                            chart_container.append('<h4>Weekly Activity Trend</h4>');
                            new frappe.Chart(chart_container[0], data.line_chart);
                        }
                    }
                }
            });
        }).css({
            "color": "white", 
            "background-color": "#14141f", 
            "font-weight": "600"
        });
        frm.trigger('reload_logs');
        if(frm.doc.custom_register_open) {
            showCloseRegisterDialog(frm, true); // Force overlay
        }
    },

    load_floor_plan: function(frm) {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Game Space',
                fields: ['tv_type', 'game_space_id', 'playstation_type', 'occupied', 'created_on', 'docstatus'],
                limit_page_length: 1000
            },
            callback: function(response) {
                let spaces = response.message || [];
                let max_id = (spaces.length > 0) ? Math.max(...spaces.map(s => parseInt(s.game_space_id || 0) || 0)) : 0;

                let finalHTML = `<h2 style="text-align: center; font-weight: bold; margin: 20px 0;">Café Floor Plan</h2>`;
                finalHTML += `
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img width="48" height="48" src="https://img.icons8.com/pulsar-line/48/plus.png" alt="plus" 
                             style="cursor:pointer;"
                             onclick="openAddGameSpaceDialog(${max_id})" 
                             title="Add a New Game Space"/>
                    </div>
                `;

                if (spaces.length > 0) {
                    finalHTML += `
                        <div class="floor-grid" style="
                            display: grid; 
                            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); 
                            grid-gap: 20px; 
                            padding: 20px;
                            justify-items: center; 
                            align-items: start;
                            border: 1px solid #ccc;
                            border-radius: 5px;
                        ">
                    `;

                    spaces.forEach(function(space) {
                        let icon = getPlaystationIcon(space.playstation_type);
                        let statusColor = (space.occupied === "Occupied") ? 'green' : 'red';
                        let statusTitle = (space.occupied === "Occupied") ? 'Occupied' : 'Not Occupied';
                        let statusDot = `<div style="width: 10px; height: 10px; background: ${statusColor}; border-radius: 50%; display: inline-block; margin-left: 5px;" title="${statusTitle}"></div>`;
                        let stationLabel = `<div style="font-weight: bold; margin-top: 5px;">Station: ${space.game_space_id}</div>`;

                        finalHTML += `
                            <div class="station-item" style="text-align: center; cursor: pointer;" 
                                 onclick="openOccupyDialog('${space.game_space_id}', '${space.occupied}')">
                                ${icon}
                                ${stationLabel}
                                ${statusDot}
                            </div>
                        `;
                    });

                    finalHTML += `</div>`;
                } else {
                    finalHTML += '<p style="text-align:center;">No game spaces are set up yet.</p>';
                }

                frm.get_field('floor_plan').$wrapper.html(finalHTML);
            }
        });
    },

    check_active_session_timers: function(frm) {
        let sessions = loadActiveSessionsFromLocalStorage();
        Object.values(sessions).forEach(session_data => {
            startPermanentTimerAlert(session_data.game_space, session_data.session_started_at);
        });
    }
});

function logCaffeAction(message) {
    frappe.call({
        method: "playstation_digital_system.frappe_playstation_digital_system.doctype.caffe.caffe.log_caffe_action",
        args: {
            caffe_name: cur_frm.doc.name,
            message: message
        },
        callback: function() {
            cur_frm.reload_doc();
        }
    });
}
function getPlaystationIcon(playstation_type) {
    if (playstation_type === 'PS5') {
        return '<img width="80" height="80" src="https://img.icons8.com/dotty/80/playstation-5.png" alt="PlayStation 5"/>';
    } else if (playstation_type === 'PS4') {
        return '<img width="100" height="100" src="https://img.icons8.com/plasticine/100/playstation-4.png" alt="PlayStation 4"/>';
    } else if (playstation_type === 'PS3') {
        return '<img width="50" height="50" src="https://img.icons8.com/ios-filled/50/play-station.png" alt="PlayStation 3"/>';
    } else {
        return '<img width="50" height="50" src="https://img.icons8.com/ios-filled/50/controller.png" alt="Game Console"/>';
    }
}

if (typeof window.openAddGameSpaceDialog !== 'function') {
    window.openAddGameSpaceDialog = function(max_id) {
        let next_id = max_id + 1;  
        let addDialog = new frappe.ui.Dialog({
            title: 'Add a New Game Space',
            fields: [
                {
                    label: 'Confirmation',
                    fieldname: 'info',
                    fieldtype: 'HTML',
                    options: `<p>Do you want to add a new Game Space?<br>The new station ID will be <b>${next_id}</b>.</p>`
                }
            ],
            primary_action_label: 'Add Game Space',
            primary_action: function() {
                frappe.new_doc('Game Space', { game_space_id: next_id });
                addDialog.hide();
            }
        });
        addDialog.show();
    }
}

if (typeof window.openOccupyDialog !== 'function') {
    window.openOccupyDialog = function(game_space_id, current_status) {
        let currently_occupied = (current_status === "Occupied");
        let next_action = currently_occupied ? 'terminate' : 'occupy';

        let dialog = new frappe.ui.Dialog({
            title: 'Change Occupation Status',
            fields: [
                {
                    label: 'Status Information',
                    fieldname: 'info',
                    fieldtype: 'HTML',
                    options: `<p>This station is currently <b>${current_status}</b>.<br>Would you like to ${next_action} this station?</p>`
                }
            ],
            primary_action_label: currently_occupied ? 'Terminate Session' : 'Occupy',
            primary_action: function() {
                dialog.hide();
                if (currently_occupied) {
                    frappe.call({
                        method: 'playstation_digital_system.frappe_playstation_digital_system.doctype.caffe.caffe.terminate_session_for_space',
                        args: { game_space_id: game_space_id },
                        callback: function(r) {
                            let si_name = r.message;
                            let sessions = loadActiveSessionsFromLocalStorage();
                            delete sessions[game_space_id];
                            saveActiveSessionsToLocalStorage(sessions);
                            removeTimerForGameSpace(game_space_id);
                            logCaffeAction(`Sales Invoice ${si_name} created.`);
                            logCaffeAction(`Game Space ${game_space_id} Not Occupied.`);
                            frappe.show_alert({
                                message: `Session terminated and space vacated.<br><a href="/app/sales-invoice/${si_name}" target="_blank">View Sales Invoice</a>`,
                                // message: `Session terminated and space vacated.<br><a href="http://erp.com:8000/app/sales-invoice/${si_name}" target="_blank">View Sales Invoice</a>`,
                                indicator: 'green'
                            }, 10);

                            cur_frm.trigger('load_floor_plan');
                        }
                    });
                    showPaymentModeDialog(game_space_id);
                } else {
                    showGameSelection(game_space_id);
                    logCaffeAction(`Game Space ${game_space_id} Occupied.`);
                }
            }
        });
        
        dialog.show();
    }
}

function showPaymentModeDialog(game_space_id = null) {
    let paymentDialog = new frappe.ui.Dialog({
        title: 'Select Payment Mode',
        fields: [
            {
                fieldname: 'payment_mode',
                fieldtype: 'HTML',
                options: `
                    <div style="text-align:center;">
                        <h4>Choose Payment Method</h4>
                        <div style="display: flex; justify-content: space-around; margin-top: 20px;">
                            <div class="payment-icon" id="cash-icon" style="cursor:pointer; text-align:center;">
                                <img src="https://img.icons8.com/officel/80/cash-in-hand.png" alt="Cash"/><br>Cash
                            </div>
                            <div class="payment-icon" id="mpesa-icon" style="cursor:pointer; text-align:center;">
                                <img src="https://img.icons8.com/color/80/mpesa.png" alt="Mpesa"/><br>Mpesa
                            </div>
                            <div class="payment-icon" id="bank-icon" style="cursor:pointer; text-align:center;">
                                <img src="https://img.icons8.com/external-flaticons-lineal-color-flat-icons/64/external-bank-banking-flaticons-lineal-color-flat-icons-10.png" alt="Bank"/><br>Bank
                            </div>
                        </div>
                    </div>
                `
            }
        ]
    });

    paymentDialog.show();
    paymentDialog.$wrapper.find('#cash-icon').on('click', function () {
        // frappe.msgprint('Cash selected'); // Debugging message
        showUnpaidSalesInvoicesDialog(game_space_id, 'Cash', paymentDialog);
    });

    paymentDialog.$wrapper.find('#mpesa-icon').on('click', function () {
        // frappe.msgprint('Mpesa selected'); // Debugging message
        showUnpaidSalesInvoicesDialog(game_space_id, 'Mpesa', paymentDialog);
    });

    paymentDialog.$wrapper.find('#bank-icon').on('click', function () {
        // frappe.msgprint('Bank selected'); // Debugging message
        showUnpaidSalesInvoicesDialog(game_space_id, 'Bank', paymentDialog);
    });
}


function selectPaymentMethod(game_space_id, method) {
    showUnpaidSalesInvoicesDialog(game_space_id, method);
}

function showUnpaidSalesInvoicesDialog(game_space_id, method, paymentDialog) {
    const salesInvoiceDialog = new frappe.ui.form.MultiSelectDialog({
        doctype: 'Sales Invoice',
        target: cur_frm,
        setters: {
            customer: 'Walkin',
            posting_date: frappe.datetime.nowdate()
        },
        add_filters_group: 1,
        date_field: 'posting_date',
        // allow_child_item_selection: 1, 
        child_fieldname: 'items', 
        child_columns: [
            { fieldname: 'item_name', label: 'Item Name', fieldtype: 'Data', width: 150 },
            { fieldname: 'base_amount', label: 'Base Amount', fieldtype: 'Currency', width: 120 }
        ],
        columns: [
            { fieldname: 'name', label: 'Invoice Name', fieldtype: 'Data', width: 200 },
            { fieldname: 'customer', label: 'Customer', fieldtype: 'Data', width: 150 },
            { fieldname: 'grand_total', label: 'Grand Total', fieldtype: 'Currency', width: 150 },
            { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', width: 120 },
            // { fieldname: 'posting_time', label: 'Posting Time', fieldtype: 'Time', width: 100 }
            
        ],
        get_query: () => {
            return {
                filters: {
                    docstatus: 1, 
                    status: ['!=', 'Paid'] 
                },
                order_by: 'posting_date desc, posting_time desc', 
                fields: ['name', 'customer', 'posting_date', 'posting_time', 'grand_total']
            };
        },
        action: (selections, args) => {
            if (selections.length === 0) {
                frappe.msgprint('Please select at least one Sales Invoice.');
                return;
            }
            const selected_items = args.filtered_children || [];
            console.log('Selected Items:', selected_items);
            showPaymentDetailsDialog(game_space_id, method, selections, paymentDialog, salesInvoiceDialog);
        }
    });
}


function showPaymentDetailsDialog(game_space_id, method, invoice_ids, paymentDialog, salesInvoiceDialog) {
    salesInvoiceDialog.dialog.hide(); 

    let fields = [];

    if (method === 'Cash') {
        fields.push({
            label: 'Amount Paid',
            fieldname: 'amount',
            fieldtype: 'Currency',
            placeholder: 'Enter cash amount paid'
        });
    } else if (method === 'Mpesa') {
        fields.push(
            {
                label: 'Phone Number',
                fieldname: 'phone',
                fieldtype: 'Data',
                default: '+254',
                placeholder: 'Enter phone number'
            },
            {
                label: 'Amount Paid',
                fieldname: 'amount',
                fieldtype: 'Currency',
                placeholder: 'Enter Mpesa payment amount'
            }
        );
    } else if (method === 'Bank') {
        fields.push(
            {
                label: 'Bank Name',
                fieldname: 'bank',
                fieldtype: 'Select',
                options: 'Equity Bank\nFamily Bank\nKCB\nStan Chart',
                placeholder: 'Select Bank'
            },
            {
                label: 'Amount Paid',
                fieldname: 'amount',
                fieldtype: 'Currency',
                placeholder: 'Enter bank transfer amount'
            }
        );
    }

    const paymentDetailsDialog = frappe.prompt(fields, (values) => {
        frappe.confirm(
            'Are you sure you want to proceed with this payment?',
            () => processPayment(game_space_id, method, values, invoice_ids), 
            () => frappe.msgprint('Payment canceled.') 
        );
    }, 'Enter Payment Details', 'Process Payment');

}

function handleCloseRegister(frm) {
    frappe.call({
        method: 'playstation_digital_system.frappe_playstation_digital_system.doctype.caffe_settings.caffe_settings.is_automatic_closure_enabled',
        callback: function(r) {
            if (r.message === true) {
                // Automatic closure is enabled
                frappe.msgprint({
                    title: __('Automatic Closure Enabled'),
                    message: __('Closure of Register is set to Automatic. If you wish to do it manually, please update the settings in <a href="/app/caffe-settings" target="_blank">Caffe Settings</a>.'),
                    indicator: 'black'
                });
            } else {
                // Automatic closure is disabled, proceed with manual closure logic
                frappe.msgprint({
                    title: __('Confirmation'),
                    message: __('Are you sure you want to close the register?'),
                    indicator: 'blue',
                    primary_action: {
                        label: 'Proceed',
                        action: function() {
                            frappe.call({
                                method: 'frappe.client.set_value',
                                args: {
                                    doctype: frm.doc.doctype,
                                    name: frm.doc.name,
                                    fieldname: 'custom_register_open',
                                    value: true
                                },
                                callback: function(r) {
                                    if(!r.exc) {
                                        frm.reload_doc();
                                        showCloseRegisterDialog(frm, true);
                                    }
                                }
                            });
                        }
                    },
                    secondary_action: {
                        label: 'Cancel'
                    }
                });
            }
        }
    });
}


function showCloseRegisterDialog(frm, force_overlay=false) {
    const today = frappe.datetime.nowdate();

    frappe.call({
        method: 'playstation_digital_system.apis.reports_api.get_todays_invoices_summary',
        args: { date: today },
        callback: function(r) {
            let data = r.message || {
                total_unpaid: 0,
                total_paid: 0,
                invoices: []
            };
            let total_unpaid = data.total_unpaid;
            let total_paid = data.total_paid;
            let total_expected = total_unpaid + total_paid;

            // Construct the dialog fields
            let fields = [
                {
                    label: `Day ${today} Total Unpaid Sales Invoices`,
                    fieldname: 'total_unpaid',
                    fieldtype: 'Currency',
                    read_only: 1,
                    default: total_unpaid
                },
                {
                    label: `Day ${today} Total Paid Sales Invoices`,
                    fieldname: 'total_paid',
                    fieldtype: 'Currency',
                    read_only: 1,
                    default: total_paid
                },
                {
                    label: `Day ${today} Total Revenue Expected`,
                    fieldname: 'total_expected',
                    fieldtype: 'Currency',
                    read_only: 1,
                    default: total_expected
                },
                {
                    label: `Day ${today} Revenue Received`,
                    fieldname: 'revenue_received',
                    fieldtype: 'HTML',
                    options: `<div style="display:flex;align-items:center;">
                                <span id="revenue_amount_display">0.00</span>
                                <span style="margin-left:10px;cursor:pointer;" id="edit_revenue_icon">
                                    <img src="https://img.icons8.com/ios-glyphs/20/pencil--v1.png"/>
                                </span>
                              </div>`
                },
                {
                    label: 'Cash',
                    fieldname: 'cash_amount',
                    fieldtype: 'Currency',
                    hidden: 1
                },
                {
                    label: 'Bank',
                    fieldname: 'bank_amount',
                    fieldtype: 'Currency',
                    hidden: 1
                },
                {
                    label: 'Mpesa',
                    fieldname: 'mpesa_amount',
                    fieldtype: 'Currency',
                    hidden: 1
                }
            ];

            let closeRegisterDialog = new frappe.ui.Dialog({
                title: `Close Register - ${today}`,
                fields: fields,
                primary_action_label: 'Close Register',
                primary_action(values) {
                    // Sum the inputs
                    let cash = values.cash_amount || 0;
                    let bank = values.bank_amount || 0;
                    let mpesa = values.mpesa_amount || 0;
                    let paid_amount = cash + bank + mpesa;

                    if(paid_amount <= 0) {
                        frappe.msgprint(__('Please input a payment amount before closing the register.'));
                        return;
                    }

                    // Process payment for today's invoices
                    processRegisterClosurePayment(frm, paid_amount, data.invoices)
                        .then(() => {
                            frappe.show_alert({
                                message: __('Total Revenue has been allocated successfully!'),
                                indicator: 'green'
                            });
                            closeRegisterDialog.hide();
                            removeOverlay();
                            frappe.call({
                                method: 'frappe.client.set_value',
                                args: {
                                    doctype: frm.doc.doctype,
                                    name: frm.doc.name,
                                    fieldname: 'custom_register_open',
                                    value: false
                                },
                                callback: function(r) {
                                    if(!r.exc) {
                                        frm.reload_doc().then(() => {
                                            // Now check if business is closed after doc reload
                                            frappe.call({
                                                method: 'playstation_digital_system.frappe_playstation_digital_system.doctype.caffe_settings.caffe_settings.is_business_closed',
                                                callback: function(res) {
                                                    console.log("Business closed check:", res.message);
                                                    if (res.message) { // if true or truthy
                                                        showBusinessClosedOverlay();
                                                    }
                                                }
                                            });
                                        });
                                    }
                                }
                            });
                            
                        })
                        .catch(err => {
                            frappe.msgprint({
                                title: __('Error'),
                                message: err.message,
                                indicator: 'red'
                            });
                        });
                }
            });

            // Show the dialog
            closeRegisterDialog.show();

            // If force_overlay is true, apply a custom overlay
            if(force_overlay) {
                applyOverlay(closeRegisterDialog);
            }

            // Attach event to edit_revenue_icon to show hidden fields
            closeRegisterDialog.$wrapper.find('#edit_revenue_icon').on('click', () => {
                closeRegisterDialog.set_df_property('cash_amount', 'hidden', 0);
                closeRegisterDialog.set_df_property('bank_amount', 'hidden', 0);
                closeRegisterDialog.set_df_property('mpesa_amount', 'hidden', 0);
                // Optionally, focus on the first input
                setTimeout(() => {
                    closeRegisterDialog.$wrapper.find('[data-fieldname="cash_amount"] input').focus();
                }, 100);
            });
        },
        error: function(err) {
            frappe.msgprint({
                title: __('Error'),
                message: __('Failed to fetch invoices summary. Please try again later.'),
                indicator: 'red'
            });
        }
    });
}

function showBusinessClosedOverlay() {
    let overlay = $('<div id="business_closed_overlay"></div>');
    overlay.css({
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'background-color': 'rgba(0,0,0,0.7)',
        color: '#fff',
        'z-index': '9999',
        display: 'flex',
        'justify-content': 'center',
        'align-items': 'center',
        'font-size': '24px',
        'font-weight': 'bold',
        'text-align': 'center',
        'padding': '20px'
    });
    overlay.html("BUSINESS IS CLOSED. Please wait until the start time to resume operations.");

    $('body').append(overlay);
}
// Apply Overlay to Prevent Other Operations
function applyOverlay(dialog) {
    // Add a CSS overlay
    let overlay = $('<div id="register_overlay"></div>');
    overlay.css({
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'background-color': 'rgba(0,0,0,0.5)',
        'z-index': '9998'
    });
    $('body').append(overlay);

    // Ensure dialog is always on top
    $(dialog.$wrapper).css('z-index', '9999');
}

// Remove the Overlay
function removeOverlay() {
    $('#register_overlay').remove();
}

// Process Register Closure Payment Allocation
// Process Register Closure Payment Allocation
function processRegisterClosurePayment(frm, paid_amount, invoices) {
    return new Promise((resolve, reject) => {
        invoices.sort((a, b) => new Date(a.posting_date) - new Date(b.posting_date));

        let total_outstanding = invoices.reduce((sum, inv) => sum + inv.outstanding_amount, 0);
        let remaining = paid_amount;
        const references = [];
        for (let i = 0; i < invoices.length; i++) {
            let inv = invoices[i];
            if (remaining <= 0) break;

            let allocate = Math.min(remaining, inv.outstanding_amount);
            references.push({
                reference_doctype: 'Sales Invoice',
                reference_name: inv.name,
                total_amount: inv.outstanding_amount,
                outstanding_amount: inv.outstanding_amount,
                allocated_amount: allocate
            });
            remaining -= allocate;
        }

        // If no references to allocate
        if (references.length === 0) {
            reject(new Error(__('No invoices to allocate payment to.')));
            return;
        }

        let first_invoice = invoices[0];
        let company = first_invoice.company;
        let customer = first_invoice.customer;
        let currency = first_invoice.currency;
        frappe.call({
            method: 'playstation_digital_system.apis.utils.get_custom_accounts',
            args: { company: company },
            callback: function(response) {
                if (!response.message) {
                    reject(new Error(__('Failed to fetch custom accounts.')));
                    return;
                }

                const accounts = response.message;

                // Prep Payment Entry
                let payment_entry_doc = {
                    doctype: 'Payment Entry',
                    payment_type: 'Receive',
                    company: company,
                    posting_date: frappe.datetime.nowdate(),
                    mode_of_payment: 'Cash', //Can be dynamic as well
                    party_type: 'Customer',
                    party: customer,
                    paid_from: accounts.debtors, 
                    paid_to: accounts.bank_account, 
                    paid_amount: paid_amount,
                    received_amount: paid_amount,
                    paid_from_account_currency: currency,
                    paid_to_account_currency: currency,
                    references: references
                };
                frappe.call({
                    method: 'frappe.client.insert',
                    args: { doc: payment_entry_doc },
                    callback: function(r) {
                        if (r.message) {
                            let payment_entry = r.message;
                            frappe.call({
                                method: 'frappe.client.submit',
                                args: { doc: payment_entry },
                                callback: function(submit_response) {
                                    if (submit_response.message) {
                                        frappe.show_alert({
                                            message: __(
                                                `Payment Entry <a href="/app/payment-entry/${payment_entry.name}" target="_blank">${payment_entry.name}</a> submitted successfully!`
                                            ),
                                            indicator: 'green'
                                        });
                                        logCaffeAction(`Payment Entry ${payment_entry.name} Created.`);
                                        resolve();
                                    } else {
                                        reject(new Error(__('Failed to submit Payment Entry.')));
                                    }
                                },
                                error: function(err) {
                                    reject(new Error(__('Failed to submit Payment Entry: ') + err.message));
                                }
                            });
                        } else {
                            reject(new Error(__('Failed to create Payment Entry.')));
                        }
                    },
                    error: function(err) {
                        reject(new Error(__('Failed to create Payment Entry: ') + err.message));
                    }
                });
            },
            error: function(err) {
                reject(new Error(__('Failed to fetch custom accounts: ') + err.message));
            }
        });
    });
}


// Apply or Remove Overlay Based on Register Status
function applyOverlay(dialog) {
    // Add a CSS overlay
    let overlay = $('<div id="register_overlay"></div>');
    overlay.css({
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'background-color': 'rgba(0,0,0,0.5)',
        'z-index': '9998'
    });
    $('body').append(overlay);

    // Ensure dialog is always on top
    $(dialog.$wrapper).css('z-index', '9999');
}

function removeOverlay() {
    $('#register_overlay').remove();
}

function processPayment(game_space_id, method, payment_details, invoice_ids) {
    const paid_amount = payment_details.amount;
    const mode_of_payment = method;

    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Sales Invoice',
            filters: { name: ['in', invoice_ids] },
            fields: ['name', 'outstanding_amount', 'customer', 'company', 'currency']
        },
        callback: function(response) {
            const invoices = response.message;

            if (!invoices || invoices.length === 0) {
                frappe.msgprint(__('No invoices found for processing.'));
                return;
            }

            let remaining_amount = paid_amount;
            const references = [];

            invoices.forEach((invoice) => {
                const allocated_amount = Math.min(remaining_amount, invoice.outstanding_amount);
                references.push({
                    reference_doctype: 'Sales Invoice',
                    reference_name: invoice.name,
                    total_amount: invoice.outstanding_amount,
                    outstanding_amount: invoice.outstanding_amount,
                    allocated_amount: allocated_amount
                });
                remaining_amount -= allocated_amount;
                if (remaining_amount <= 0) return false;
            });

            const first_invoice = invoices[0];

            if (references.length === 0) {
                frappe.msgprint(__('No amount could be allocated to the selected invoices.'));
                return;
            }

            frappe.call({
                method: 'playstation_digital_system.apis.utils.get_custom_accounts',
                args: { company: first_invoice.company },
                callback: function(account_response) {
                    const accounts = account_response.message;

                    if (!accounts) {
                        frappe.msgprint(__('Failed to fetch custom accounts.'));
                        return;
                    }

                    // Prepare Payment Entry Document
                    const payment_entry_doc = {
                        doctype: 'Payment Entry',
                        payment_type: 'Receive',
                        company: first_invoice.company,
                        posting_date: frappe.datetime.nowdate(),
                        mode_of_payment: mode_of_payment,
                        party_type: 'Customer',
                        party: first_invoice.customer,
                        paid_from: accounts.debtors, 
                        paid_to: accounts.bank_account, 
                        paid_amount: paid_amount,
                        received_amount: paid_amount,
                        paid_from_account_currency: first_invoice.currency,
                        paid_to_account_currency: first_invoice.currency,
                        references: references
                    };

                    frappe.call({
                        method: 'frappe.client.insert',
                        args: { doc: payment_entry_doc },
                        callback: function(insert_response) {
                            const payment_entry = insert_response.message;
                            frappe.call({
                                method: 'frappe.client.submit',
                                args: { doc: payment_entry },
                                callback: function() {
                                    frappe.show_alert({
                                        message: __(
                                            `Payment Entry <a href="/app/payment-entry/${payment_entry.name}" target="_blank">${payment_entry.name}</a> submitted successfully!`
                                        ),
                                        indicator: 'green'
                                    });
                                    cur_frm.reload_doc();
                                },
                                error: function(submit_error) {
                                    frappe.msgprint({
                                        title: __('Error'),
                                        message: __('Failed to submit Payment Entry: {0}').format(submit_error.message),
                                        indicator: 'red'
                                    });
                                }
                            });
                        },
                        error: function(insert_error) {
                            frappe.msgprint({
                                title: __('Error'),
                                message: __('Failed to create Payment Entry: {0}').format(insert_error.message),
                                indicator: 'red'
                            });
                        }
                    });

                    logCaffeAction(`Payment Entry Created for customer ${first_invoice.customer}.`);
                },
                error: function(account_error) {
                    frappe.msgprint({
                        title: __('Error'),
                        message: __('Failed to fetch custom accounts: {0}').format(account_error.message),
                        indicator: 'red'
                    });
                }
            });
        },
        error: function(invoice_error) {
            frappe.msgprint({
                title: __('Error'),
                message: __('Failed to fetch invoices: {0}').format(invoice_error.message),
                indicator: 'red'
            });
        }
    });
}


// function processPayment(game_space_id, method, values) {
//     // Stub for payment processing logic
//     frappe.msgprint(`Processing ${method} payment for Game Space ID: ${game_space_id}<br>Details: ${JSON.stringify(values)}`);
    
//     // Here you can add the logic for creating a Payment Entry in Frappe
//     // frappe.call({
//     //     method: 'frappe.client.insert',
//     //     args: {
//     //         doc: {
//     //             doctype: 'Payment Entry',
//     //             payment_type: 'Receive',
//     //             mode_of_payment: method,
//     //             party_type: 'Customer',
//     //             party: 'Customer Name', // Replace with actual customer data
//     //             paid_amount: values.amount,
//     //             references: [{
//     //                 reference_doctype: 'Sales Invoice',
//     //                 reference_name: 'SI-00001', // Replace with actual sales invoice
//     //                 allocated_amount: values.amount
//     //             }]
//     //         }
//     //     },
//     //     callback: function(response) {
//     //         frappe.msgprint('Payment recorded successfully!');
//     //     }
//     // });
// }

function updateOccupancy(game_space_id, new_status) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'frappe.client.get_value',
            args: {
                doctype: 'Game Space',
                filters: { 'game_space_id': game_space_id },
                fieldname: ['name']
            },
            callback: function(r) {
                if (r.message && r.message.name) {
                    let docname = r.message.name;
                    frappe.call({
                        method: 'frappe.client.set_value',
                        args: {
                            doctype: 'Game Space',
                            name: docname,
                            fieldname: 'occupied',
                            value: new_status
                        },
                        callback: function() {
                            resolve();
                        }
                    });
                } else {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Could not find the Game Space record.',
                        indicator: 'red'
                    });
                    reject();
                }
            }
        });
    });
}

if (typeof window.showGameSelection !== 'function') {
    window.showGameSelection = function(game_space_id) {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Games',
                fields: ['name', 'name_of_the_game', 'attach_image', 'pricing_rate', 'pricing_duration', 'custom_duration', 'game_pricing', 'rate_per_hour'],
                limit_page_length: 1000
            },
            callback: function(res) {
                let all_games = res.message || [];
                if (all_games.length === 0) {
                    frappe.msgprint("No games available.");
                    return;
                }

                let searchHTML = `
                    <div style="text-align:center; margin-bottom:10px;">
                        <h3 style="margin-bottom:10px;">Select a Game</h3>
                        <input type="text" id="game_search_input" 
                               placeholder="Search for a game..." 
                               style="width:80%; padding:5px; border:1px solid #ccc; border-radius:3px;"/>
                    </div>
                    <div id="game_container" style="
                        display: grid; 
                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                        grid-gap: 15px;
                        padding: 10px;
                        max-height:300px;
                        overflow:auto;
                    ">
                    </div>
                `;

                let gameDialog = new frappe.ui.Dialog({
                    title: 'Choose a Game to Play',
                    fields: [
                        {
                            fieldtype: 'HTML',
                            fieldname: 'game_list',
                            options: searchHTML
                        }
                    ]
                });

                gameDialog.show();

                renderGameList(all_games, game_space_id, gameDialog);

                let input = gameDialog.$wrapper.find('#game_search_input');
                input.on('input', function() {
                    let query = $(this).val().toLowerCase();
                    let filtered_games = all_games.filter(g => g.name_of_the_game.toLowerCase().includes(query));
                    renderGameList(filtered_games, game_space_id, gameDialog);
                });
            }
        });
    }
}

function renderGameList(games, game_space_id, gameDialog) {
    let container = gameDialog.$wrapper.find('#game_container');
    container.empty();

    games.forEach(function(g) {
        let img_url = g.attach_image ? frappe.urllib.get_full_url('/' + g.attach_image) : "https://img.icons8.com/ios-filled/50/controller.png";
        let gameCard = $(`
            <div class="game-card" 
                 style="text-align:center; cursor:pointer; border:1px solid #ccc; border-radius:5px; padding:10px;">
                <img src="${img_url}" alt="${g.name_of_the_game}" style="width:80px;height:80px;object-fit:cover;border-radius:5px;margin-bottom:10px;">
                <div style="font-weight:bold;">${g.name_of_the_game}</div>
            </div>
        `);
        gameCard.click(function() {
            gameDialog.hide();
            updateOccupancy(game_space_id, "Occupied").then(() => {
                frappe.call({
                    method: 'playstation_digital_system.frappe_playstation_digital_system.doctype.game_session.game_session.create_game_session',
                    args: {
                        game_space_id: game_space_id,
                        game_name: g.name
                    },
                    callback: function(r) {
                        if (r.message) {
                            let session_data = r.message; 
                            let sessions = loadActiveSessionsFromLocalStorage();
                            sessions[session_data.game_space] = session_data;
                            saveActiveSessionsToLocalStorage(sessions);

                            // Show transient notification
                            frappe.show_alert({
                                message: __('Game Session for Game Space ' + session_data.game_space + ' and Game ' + session_data.game_played + ' has started.'),
                                indicator: 'green'
                            }, 5);

                            // After 5 seconds, show a permanent timer
                            setTimeout(() => {
                                startPermanentTimerAlert(session_data.game_space, session_data.session_started_at);
                            }, 5000);

                            // Refresh the Caffe page
                            cur_frm.reload_doc();
                        }
                    }
                });
            });
        });
        container.append(gameCard);
    });
}

// Prompt for Payment (Phone and Amount)
function openPaymentDialog() {
    frappe.prompt([
        {
            label: 'Phone',
            fieldname: 'phone',
            fieldtype: 'Data',
            default: '+254'
        },
        {
            label: 'Amount to Pay',
            fieldname: 'amount',
            fieldtype: 'Currency'
        },
        {
            label: 'Pay for Invoice No',
            fieldname: 'invoice_id',
            fieldtype: 'Data'
        }
    ],
    (values) => {
        // On process payment click
        frappe.call({
            method: 'playstation_digital_system.apis.mpesa_payments.pay_via_tinypesa',
            args: {
                phone: values.phone,
                amount: values.amount,
                invoice_id: values.invoice_id
            },
            callback: function(r) {
                // After successful trigger, redirect to Payment Entry Page
                // Assuming we get a payment entry name from the response
                if (r.message) {
                    let payment_entry_name = r.message;
                    frappe.set_route('Form', 'Payment Entry', payment_entry_name);
                } else {
                    frappe.msgprint('Payment triggered. Please check your phone.');
                }
            }
        });
    },
    __('Process Payment'), 
    __('Process Payment') 
    );
}

function showTransactionsDialog() {
    const today = frappe.datetime.nowdate();
    const yesterday = frappe.datetime.add_days(today, -1);
    const last3Days = frappe.datetime.add_days(today, -3);
    const thisWeekStart = getFirstDayOfWeek(today);
    const fortnightStart = frappe.datetime.add_days(today, -14);
    const thisMonthStart = frappe.datetime.month_start(today);

    let transactionData = { sales_invoices: [], payments: [], filters: null };

    let dialog = new frappe.ui.Dialog({
        title: 'View Transactions💰',
        fields: [
            {
                label: 'Select Range',
                fieldname: 'date_range',
                fieldtype: 'Select',
                options: [
                    { label: 'Today', value: 'today' },
                    { label: 'Yesterday', value: 'yesterday' },
                    { label: 'Last 3 Days', value: 'last_3_days' },
                    { label: 'This Week', value: 'this_week' },
                    { label: 'Last Fortnight', value: 'last_fortnight' },
                    { label: 'This Month', value: 'this_month' },
                    { label: 'Custom Range', value: 'custom' }
                ],
                default: 'today'
            },
            {
                label: 'Start Date',
                fieldname: 'start_date',
                fieldtype: 'Date',
                depends_on: 'eval:doc.date_range=="custom"'
            },
            {
                label: 'End Date',
                fieldname: 'end_date',
                fieldtype: 'Date',
                depends_on: 'eval:doc.date_range=="custom"'
            },
            {
                label: 'Total Sales Invoice Revenue',
                fieldname: 'sales_invoice_total',
                fieldtype: 'Currency',
                read_only: 1
            },
            {
                label: 'Total Payments Received',
                fieldname: 'payments_total',
                fieldtype: 'Currency',
                read_only: 1
            },
            {
                label: 'Show Breakdown',
                fieldname: 'show_breakdown',
                fieldtype: 'Check',
                onchange: function() {
                    const showBreakdown = dialog.get_value('show_breakdown');
                    toggleEmailButton(showBreakdown);
                    if (!transactionData.filters) {
                        frappe.msgprint('Fetching data, please wait...');
                        const filters = getFilters(dialog.get_values(), {
                            today,
                            yesterday,
                            last3Days,
                            thisWeekStart,
                            fortnightStart,
                            thisMonthStart
                        });
                        fetchTransactionData(filters, dialog, transactionData);
                    } else {
                        renderBreakdownTables(dialog, transactionData);
                    }
                }
            },
            {
                label: 'Breakdown Section',
                fieldname: 'breakdown_html',
                fieldtype: 'HTML',
                depends_on: 'eval:doc.show_breakdown==1'
            }
        ],
        primary_action_label: 'Fetch Transactions',
        primary_action: function(values) {
            const filters = getFilters(values, {
                today,
                yesterday,
                last3Days,
                thisWeekStart,
                fortnightStart,
                thisMonthStart
            });
            fetchTransactionData(filters, dialog, transactionData);
        }
    });

    // Add the "Email Report" button to the dialog footer
    const emailButton = $('<button class="btn btn-primary btn-email-report" style="display:none;">Email Report</button>')
        .click(() => openEmailDialog(transactionData, dialog))
        .prependTo(dialog.footer);

    function toggleEmailButton(show) {
        if (show) {
            emailButton.show();
        } else {
            emailButton.hide();
        }
    }

    dialog.show();
}


function openEmailDialog(transactionData, parentDialog) {
    // Dialog for Email Input
    const emailDialog = new frappe.ui.Dialog({
        title: 'Email Report',
        fields: [
            {
                label: 'Recipient Email',
                fieldname: 'email',
                fieldtype: 'Data',
                reqd: 1,
                placeholder: 'Enter recipient email'
            }
        ],
        primary_action_label: 'Send',
        primary_action: function(values) {
            emailDialog.hide();
            sendReportEmail(values.email, transactionData, parentDialog);
        }
    });

    emailDialog.show();
}

function sendReportEmail(email, transactionData, parentDialog) {
    const breakdownHTML = parentDialog.get_value('breakdown_html');
    const reportTitle = `Transaction Report - ${frappe.datetime.now_datetime()}`;
    frappe.show_progress('Emailing Report', 0, 100, 'Preparing email...');
    
    frappe.call({
        method: 'playstation_digital_system.apis.pdf.send_transaction_report',
        args: {
            email: email,
            html_content: `
                <html>
                <head>
                    <title>${reportTitle}</title>
                </head>
                <body>
                    ${breakdownHTML}
                </body>
                </html>
            `,
            report_title: reportTitle
        },
        callback: function(response) {
            frappe.show_progress('Emailing Report', 100, 100, 'Email Sent');
            
            // Clear the progress bar after 2 seconds
            setTimeout(() => frappe.hide_progress(), 2000);

            // Show success message with response message
            if (response.message && response.message.message) {
                frappe.show_alert({
                    message: response.message.message, 
                    indicator: 'green'
                });
            } else {
                frappe.show_alert({
                    message: "Email sent successfully!", 
                    indicator: 'green'
                });
            }
        },
        error: function(err) {
            frappe.hide_progress();
            frappe.show_alert({
                message: `Failed to send email: ${err.message || "Unknown error"}`,
                indicator: 'red'
            });
        }
    });
}


function getFirstDayOfWeek(date) {
    const currentDate = new Date(date);
    const dayOfWeek = currentDate.getDay(); 
    const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    const firstDay = new Date(currentDate.setDate(diff));
    return frappe.datetime.obj_to_str(firstDay);
}

function getFilters(values, ranges) {
    let { today, yesterday, last3Days, thisWeekStart, fortnightStart, thisMonthStart } = ranges;
    let start_date, end_date;

    switch (values.date_range) {
        case 'today':
            start_date = today;
            end_date = today;
            break;
        case 'yesterday':
            start_date = yesterday;
            end_date = today;
            break;
        case 'last_3_days':
            start_date = last3Days;
            end_date = today;
            break;
        case 'this_week':
            start_date = thisWeekStart;
            end_date = today;
            break;
        case 'last_fortnight':
            start_date = fortnightStart;
            end_date = today;
            break;
        case 'this_month':
            start_date = thisMonthStart;
            end_date = today;
            break;
        case 'custom':
            start_date = values.start_date;
            end_date = values.end_date;
            break;
    }

    return { start_date, end_date };
}

function fetchTransactionData(filters, dialog, transactionData) {
    // Fetch all sales invoices for the selected range
    fetchAllRecords('Sales Invoice', {
        posting_date: ['between', [filters.start_date, filters.end_date]],
        docstatus: 1
    }, ['name', 'posting_date', 'status', 'grand_total'], (sales_invoices) => {
        let unpaid_total = 0;
        let paid_total = 0;

        sales_invoices.forEach(inv => {
            if (inv.status === 'Paid') {
                paid_total += inv.grand_total;
            } else {
                unpaid_total += inv.grand_total;
            }
        });

        // Fetch payments after invoices
        fetchPaymentEntries(filters, unpaid_total, paid_total, sales_invoices, dialog, transactionData);
    });
}

function fetchPaymentEntries(filters, unpaid_total, paid_total, sales_invoices, dialog, transactionData) {
    fetchAllRecords('Payment Entry', {
        posting_date: ['between', [filters.start_date, filters.end_date]],
        docstatus: 1
    }, ['name', 'posting_date', 'status', 'total_allocated_amount'], (payments) => {
        let payments_total = payments.reduce((acc, cur) => acc + cur.total_allocated_amount, 0);

        transactionData.sales_invoices = sales_invoices;
        transactionData.payments = payments;
        transactionData.filters = filters;

        updateTransactionDialog(dialog, unpaid_total, paid_total, payments_total, sales_invoices, payments, filters);
    });
}

function fetchAllRecords(doctype, filters, fields, callback, start = 0, limit = 100, records = []) {
    frappe.call({
        method: 'frappe.client.get_list',
        args: { doctype, filters, fields, limit_start: start, limit_page_length: limit },
        callback: function(response) {
            const fetched = response.message || [];
            records = records.concat(fetched);

            if (fetched.length === limit) {
                fetchAllRecords(doctype, filters, fields, callback, start + limit, limit, records);
            } else {
                callback(records);
            }
        }
    });
}

function updateTransactionDialog(dialog, unpaid_total, paid_total, payments_total, sales_invoices, payments, filters) {
    let total_sales_revenue = unpaid_total + paid_total;

    dialog.set_value('sales_invoice_total', total_sales_revenue);
    dialog.set_value('payments_total', payments_total);

    // Auto-render breakdown tables if "Show Breakdown" is checked
    if (dialog.get_value('show_breakdown')) {
        renderBreakdownTables(dialog, { sales_invoices, payments, filters });
    }
}

function renderBreakdownTables(dialog, data) {
    if (!data.sales_invoices.length && !data.payments.length) {
        dialog.set_df_property('breakdown_html', 'options', '<p>No data to display. Fetch transactions first.</p>');
        return;
    }

    const period_value = `${data.filters.start_date} to ${data.filters.end_date}`;

    // Sort Sales Invoices and Payments by Posting Date (descending)
    const sortedSalesInvoices = data.sales_invoices.sort((a, b) => new Date(b.posting_date) - new Date(a.posting_date));
    const sortedPayments = data.payments.sort((a, b) => new Date(b.posting_date) - new Date(a.posting_date));

    // Sales Invoice Table
    const salesInvoiceTable = `
        <h4>Sales Invoices</h4>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Invoice Name</th>
                    <th>Posting Date</th>
                    <th>Status</th>
                    <th>Grand Total</th>
                </tr>
            </thead>
            <tbody>
                ${sortedSalesInvoices.map(inv => `
                    <tr>
                        <td>
                            <a href="/app/sales-invoice/${inv.name}" target="_blank">
                                ${inv.name}
                            </a>
                        </td>
                        <td>${inv.posting_date}</td>
                        <td>${inv.status}</td>
                        <td>${format_currency(inv.grand_total)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <p><b>Total Invoice Value as at ${period_value}:</b> ${format_currency(sortedSalesInvoices.reduce((sum, inv) => sum + inv.grand_total, 0))}</p>
    `;

    // Payments Table
    const paymentsTable = `
        <h4>Payments</h4>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Payment Entry</th>
                    <th>Posting Date</th>
                    <th>Status</th>
                    <th>Total Allocated Amount</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPayments.map(payment => `
                    <tr>
                        <td>
                            <a href="/app/payment-entry/${payment.name}" target="_blank">
                                ${payment.name}
                            </a>
                        </td>
                        <td>${payment.posting_date}</td>
                        <td>${payment.status}</td>
                        <td>${format_currency(payment.total_allocated_amount)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <p><b>Total Money Received as at ${period_value}:</b> ${format_currency(sortedPayments.reduce((sum, payment) => sum + payment.total_allocated_amount, 0))}</p>
    `;

    // Render Tables
    dialog.set_df_property('breakdown_html', 'options', `${salesInvoiceTable}<hr>${paymentsTable}`);
}



// Utility functions for sessions in localStorage
function loadActiveSessionsFromLocalStorage() {
    let sessions = localStorage.getItem('active_game_sessions');
    if (sessions) {
        return JSON.parse(sessions);
    }
    return {};
}

function saveActiveSessionsToLocalStorage(sessions) {
    localStorage.setItem('active_game_sessions', JSON.stringify(sessions));
}

// Timers container management
function createTimersParentContainer() {
    let parent = document.getElementById('session-timers-container');
    if (!parent) {
        parent = document.createElement('div');
        parent.id = 'session-timers-container';
        parent.style.position = 'fixed';
        parent.style.top = '10px';
        parent.style.right = '10px';
        parent.style.zIndex = '9999';
        parent.style.display = 'flex';
        parent.style.flexDirection = 'column';
        parent.style.gap = '10px';
        document.body.appendChild(parent);
    }
    return parent;
}

function createOrGetTimerElement(game_space) {
    let parent = createTimersParentContainer();
    let timer_id = 'session-timer-' + game_space;
    let existing = document.getElementById(timer_id);
    if (!existing) {
        let timer_div = document.createElement('div');
        timer_div.id = timer_id;
        timer_div.style.background = '#28a745';
        timer_div.style.color = '#fff';
        timer_div.style.padding = '10px 15px';
        timer_div.style.borderRadius = '4px';
        timer_div.style.fontSize = '14px';
        timer_div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        parent.appendChild(timer_div);
        return timer_div;
    }
    return existing;
}

function removeTimerForGameSpace(game_space) {
    let timer_id = 'session-timer-' + game_space;
    let el = document.getElementById(timer_id);
    if (el) {
        el.remove();
    }
}

let timerIntervals = {};

function startPermanentTimerAlert(game_space, started_at) {
    let startTime = moment(started_at);
    let timer_div = createOrGetTimerElement(game_space);

    if (timerIntervals[game_space]) {
        clearInterval(timerIntervals[game_space]);
    }

    timerIntervals[game_space] = setInterval(() => {
        let now = moment();
        let diff = moment.duration(now.diff(startTime));

        let hrs = diff.hours();
        let mins = diff.minutes();
        let secs = diff.seconds();

        let time_str = (hrs > 0 ? hrs + "h " : "") + (mins > 0 ? mins + "m " : "") + secs + "s";

        timer_div.innerHTML = `Game Space: ${game_space}<br>Session Duration: ${time_str}`;
    }, 1000);
}
