// Manages sales and payment records.

var salesPayments = [];

var salesOrdersStorageKey =
    "jorjetteangel-orders";

var salesDeliveryStatusStorageKey =
    "jorjetteangel-delivery-status";



var checkoutOrders = [];

var deliveryRecords = [];

var productionRecords = [];

var analyticsSales = [];



var selectedIndex = -1;

var deletingIndex = -1;

var nextPaymentNumber = 1;



function reportError(message) {

    var errorPanel =
        document.getElementById("errorMessage");


    if (errorPanel != null) {

        errorPanel.textContent = message;

        errorPanel.hidden = false;
    }
}


function clearReportedError() {

    var errorPanel =
        document.getElementById("errorMessage");


    if (errorPanel != null) {

        errorPanel.textContent = "";

        errorPanel.hidden = true;
    }
}


window.onerror = function (message) {

    reportError(
        "An unexpected error occurred: " + message
    );

    return true;
};



function digitToText(digit) {

    if (digit == 0) {
        return "0";
    }

    if (digit == 1) {
        return "1";
    }

    if (digit == 2) {
        return "2";
    }

    if (digit == 3) {
        return "3";
    }

    if (digit == 4) {
        return "4";
    }

    if (digit == 5) {
        return "5";
    }

    if (digit == 6) {
        return "6";
    }

    if (digit == 7) {
        return "7";
    }

    if (digit == 8) {
        return "8";
    }

    if (digit == 9) {
        return "9";
    }

    return "";
}



function integerToText(value) {

    var number = value;

    var result = "";

    var digit;


    if (number == 0) {
        return "0";
    }


    while (number > 0) {

        digit = number % 10;

        number =
            (number - digit) / 10;

        result =
            digitToText(digit) + result;
    }


    return result;
}



function generateTransactionID() {

    var numberText =
        integerToText(nextPaymentNumber);

    var transactionID =
        "TXN-PAY-";


    if (nextPaymentNumber < 10) {

        transactionID =
            transactionID +
            "000" +
            numberText;

    }

    else if (nextPaymentNumber < 100) {

        transactionID =
            transactionID +
            "00" +
            numberText;

    }

    else if (nextPaymentNumber < 1000) {

        transactionID =
            transactionID +
            "0" +
            numberText;

    }

    else {

        transactionID =
            transactionID +
            numberText;
    }


    nextPaymentNumber =
        nextPaymentNumber + 1;


    return transactionID;
}



function characterToDigit(character) {

    if (character == "0") {
        return 0;
    }

    if (character == "1") {
        return 1;
    }

    if (character == "2") {
        return 2;
    }

    if (character == "3") {
        return 3;
    }

    if (character == "4") {
        return 4;
    }

    if (character == "5") {
        return 5;
    }

    if (character == "6") {
        return 6;
    }

    if (character == "7") {
        return 7;
    }

    if (character == "8") {
        return 8;
    }

    if (character == "9") {
        return 9;
    }

    return -1;
}



function textToDecimal(text) {

    var i = 0;

    var character;

    var value = 0;

    var decimalPlace = 0;

    var decimalMode = false;

    var digit;


    while (i < text.length) {

        character =
            text[i];


        if (character == ".") {

            decimalMode = true;

        }

        else {

            digit =
                characterToDigit(character);


            if (digit >= 0) {

                if (decimalMode == false) {

                    value =
                        (value * 10) + digit;

                }

                else {

                    decimalPlace =
                        decimalPlace + 1;


                    if (decimalPlace == 1) {

                        value =
                            value +
                            (digit / 10);

                    }

                    else if (decimalPlace == 2) {

                        value =
                            value +
                            (digit / 100);
                    }

                }
            }
        }


        i = i + 1;
    }


    return value;
}



function isValidNumberText(text) {

    var i = 0;

    var character;

    var digitFound = false;

    var decimalFound = false;


    if (text == "") {
        return false;
    }


    while (i < text.length) {

        character =
            text[i];


        if (character == ".") {

            if (decimalFound == true) {
                return false;
            }

            decimalFound = true;

        }

        else {

            if (
                characterToDigit(character) < 0
            ) {

                return false;
            }

            digitFound = true;
        }


        i = i + 1;
    }


    return digitFound;
}



function formatMoney(amount) {

    var whole =
        amount -
        (amount % 1);

    var decimal =
        amount - whole;

    var decimalNumber =
        decimal * 100;

    decimalNumber =
        decimalNumber -
        (decimalNumber % 1);


    var wholeText =
        integerToText(whole);

    var decimalText =
        integerToText(decimalNumber);


    if (decimalNumber < 10) {

        decimalText =
            "0" +
            decimalText;
    }


    return "₱" +
        wholeText +
        "." +
        decimalText;
}



function determineStatus(
    totalAmount,
    amountReceived
) {

    if (amountReceived == 0) {
        return "Unpaid";
    }

    if (amountReceived >= totalAmount) {
        return "Paid";
    }

    return "Unpaid";
}



function getStatusClass(status) {

    if (status == "Paid") {
        return "paid";
    }

    return "unpaid";
}


function getPaymentOrderReference(order, index) {

    return String(
        order.reference ||
        order.orderId ||
        "ORDER-" + (index + 1)
    );
}


function formatPaymentDate(dateValue) {

    if (!dateValue) {
        return "-";
    }

    var date = new Date(dateValue);

    if (isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit"
    });
}


function loadSalesPayments() {

    var savedOrders =
        window.backendMemoryStorage.getItem(salesOrdersStorageKey);

    var orders =
        savedOrders ? JSON.parse(savedOrders) : [];

    var savedDeliveryStatuses =
        window.backendMemoryStorage.getItem(salesDeliveryStatusStorageKey);

    var deliveryStatuses =
        savedDeliveryStatuses ? JSON.parse(savedDeliveryStatuses) : {};

    if (!Array.isArray(orders)) {
        throw new Error("Saved customer orders must be an array.");
    }

    if (
        !deliveryStatuses ||
        typeof deliveryStatuses !== "object" ||
        Array.isArray(deliveryStatuses)
    ) {
        throw new Error("Saved delivery statuses must be an object.");
    }

    var highestPaymentNumber = 0;
    var orderIndex;

    for (orderIndex = 0; orderIndex < orders.length; orderIndex++) {
        var existingId =
            orders[orderIndex] &&
            (
                orders[orderIndex].paymentTransactionId ||
                orders[orderIndex].transactionId ||
                orders[orderIndex].linkedTransactionId ||
                orders[orderIndex].txnId
            );
        var paymentIdMatch =
            /^TXN-PAY-(\d+)$/.exec(String(existingId || ""));

        if (paymentIdMatch) {
            var paymentNumber = textToDecimal(paymentIdMatch[1]);
            if (paymentNumber > highestPaymentNumber) {
                highestPaymentNumber = paymentNumber;
            }
        }
    }

    nextPaymentNumber = highestPaymentNumber + 1;
    salesPayments = [];
    var changedOrders = false;

    for (orderIndex = 0; orderIndex < orders.length; orderIndex++) {
        var order = orders[orderIndex];
        if (!order || typeof order !== "object") {
            continue;
        }

        var orderId = getPaymentOrderReference(order, orderIndex);
        var delivery = deliveryStatuses[orderId] || {};
        var sourceOrderStatus = String(order.status || "");
        var fulfillmentStatus = String(
            delivery.status ||
            order.fulfillmentStatus ||
            (
                /^(dispatched|completed|delivered)$/i.test(sourceOrderStatus)
                    ? sourceOrderStatus
                    : ""
            )
        );
        var isDispatched =
            /^(dispatched|completed|delivered)$/i.test(fulfillmentStatus);
        var isCompleted =
            /^(completed|delivered)$/i.test(fulfillmentStatus) ||
            (
                !fulfillmentStatus &&
                /^(completed|delivered)$/i.test(sourceOrderStatus)
            );
        var totalAmount = Number(order.total);

        if (!Number.isFinite(totalAmount) || totalAmount < 0) {
            totalAmount = 0;
        }

        var amountReceived = Number(
            order.amountReceived ??
            order.amountPaid ??
            order.paidAmount ??
            0
        );

        if (!Number.isFinite(amountReceived) || amountReceived < 0) {
            amountReceived = 0;
        }

        if (isDispatched) {
            amountReceived = totalAmount;
        }

        if (amountReceived > totalAmount) {
            amountReceived = totalAmount;
        }

        var transactionId =
            order.paymentTransactionId ||
            order.transactionId ||
            order.linkedTransactionId ||
            order.txnId;

        if (!transactionId) {
            transactionId = generateTransactionID();
            order.paymentTransactionId = transactionId;
            changedOrders = true;
        }

        var customer =
            order.customer && typeof order.customer === "object"
                ? order.customer
                : {};
        var paymentMethod =
            order.paymentMethod || "Cash on Delivery";
        var paymentSource =
            /cash\s*on\s*delivery|\bCOD\b/i.test(paymentMethod)
                ? "COD"
                : "Custom Order";
        var items = Array.isArray(order.items) ? order.items : [];
        var orderType =
            order.orderType ||
            order.type ||
            (
                items.some(function (item) {
                    return String(item && item.size || "").toLowerCase() === "custom";
                })
                    ? "Custom Order"
                    : "Ready-to-wear"
            );
        var paymentStatus =
            isDispatched
                ? "Paid"
                : determineStatus(totalAmount, amountReceived);

        salesPayments = window.arrayWithAppended(salesPayments, [
            String(transactionId),
            orderId,
            customer.id || customer.email || order.accountEmail || "-",
            customer.name || order.customerName || "Customer unavailable",
            orderType,
            paymentSource,
            totalAmount,
            amountReceived,
            totalAmount - amountReceived,
            paymentMethod,
            paymentStatus,
            formatPaymentDate(order.createdAt || order.receivedAt),
            isDispatched
                ? "Automatically marked Paid when the order was dispatched."
                : "",
            isCompleted,
            isDispatched
        ]);
    }

    if (changedOrders) {
        window.backendMemoryStorage.setItem(
            salesOrdersStorageKey,
            JSON.stringify(orders)
        );
    }
}



function manualLowercase(text) {

    var result = "";

    var i = 0;

    var character;


    while (i < text.length) {

        character =
            text[i];


        if (character == "A") character = "a";
        else if (character == "B") character = "b";
        else if (character == "C") character = "c";
        else if (character == "D") character = "d";
        else if (character == "E") character = "e";
        else if (character == "F") character = "f";
        else if (character == "G") character = "g";
        else if (character == "H") character = "h";
        else if (character == "I") character = "i";
        else if (character == "J") character = "j";
        else if (character == "K") character = "k";
        else if (character == "L") character = "l";
        else if (character == "M") character = "m";
        else if (character == "N") character = "n";
        else if (character == "O") character = "o";
        else if (character == "P") character = "p";
        else if (character == "Q") character = "q";
        else if (character == "R") character = "r";
        else if (character == "S") character = "s";
        else if (character == "T") character = "t";
        else if (character == "U") character = "u";
        else if (character == "V") character = "v";
        else if (character == "W") character = "w";
        else if (character == "X") character = "x";
        else if (character == "Y") character = "y";
        else if (character == "Z") character = "z";


        result =
            result + character;


        i = i + 1;
    }


    return result;
}



function textExists(text, search) {

    var source =
        manualLowercase(text);

    var target =
        manualLowercase(search);


    if (target == "") {
        return true;
    }


    var sourceLength =
        source.length;

    var targetLength =
        target.length;

    var start = 0;

    var position;

    var match;


    if (targetLength > sourceLength) {
        return false;
    }


    while (
        start <=
        sourceLength - targetLength
    ) {

        match = true;

        position = 0;


        while (position < targetLength) {

            if (
                source[start + position] !=
                target[position]
            ) {

                match = false;

                break;
            }


            position =
                position + 1;
        }


        if (match == true) {
            return true;
        }


        start =
            start + 1;
    }


    return false;
}



function recordMatchesSearch(
    record,
    searchText
) {

    if (searchText == "") {
        return true;
    }


    if (
        textExists(
            record[0],
            searchText
        )
    ) {
        return true;
    }


    if (
        textExists(
            record[1],
            searchText
        )
    ) {
        return true;
    }


    if (
        textExists(
            record[2],
            searchText
        )
    ) {
        return true;
    }


    if (
        textExists(
            record[3],
            searchText
        )
    ) {
        return true;
    }


    return false;
}



function renderPayments() {

    var tableBody =
        document.getElementById(
            "paymentTableBody"
        );


    var searchText =
        document.getElementById(
            "searchPayment"
        ).value;


    var selectedStatus =
        document.getElementById(
            "statusFilter"
        ).value;


    var selectedSource =
        document.getElementById(
            "sourceFilter"
        ).value;


    tableBody.innerHTML = "";


    var visibleCount = 0;

    var i;


    for (
        i = 0;
        i < salesPayments.length;
        i = i + 1
    ) {

        var record =
            salesPayments[i];

        if (window.systemArchive.isArchived("payments", record[0])) {
            continue;
        }

        var searchMatch =
            recordMatchesSearch(
                record,
                searchText
            );


        var statusMatch = true;

        var sourceMatch = true;


        if (
            selectedStatus != "All"
        ) {

            if (
                record[10] !=
                selectedStatus
            ) {

                statusMatch = false;
            }
        }


        if (
            selectedSource != "All"
        ) {

            if (
                record[5] !=
                selectedSource
            ) {

                sourceMatch = false;
            }
        }


        if (
            searchMatch == true &&
            statusMatch == true &&
            sourceMatch == true
        ) {

            createPaymentRow(
                tableBody,
                record,
                i
            );


            visibleCount =
                visibleCount + 1;
        }
    }


    if (visibleCount == 0) {

        document.getElementById(
            "emptyMessage"
        ).style.display = "block";

    }

    else {

        document.getElementById(
            "emptyMessage"
        ).style.display = "none";
    }
}



function createPaymentRow(
    tableBody,
    record,
    index
) {

    var row =
        document.createElement("tr");


    var paymentCell =
        document.createElement("td");

    paymentCell.className =
        "payment-id";

    paymentCell.textContent =
        record[0];


    var orderCell =
        document.createElement("td");

    orderCell.textContent =
        record[1];


    var customerCell =
        document.createElement("td");

    customerCell.textContent =
        record[3];


    var sourceCell =
        document.createElement("td");


    var sourceLabel =
        document.createElement("span");

    sourceLabel.className =
        "source-label";

    sourceLabel.textContent =
        record[5];

    sourceCell.appendChild(
        sourceLabel
    );


    var totalCell =
        document.createElement("td");

    totalCell.innerHTML =
        formatMoney(record[6]);


    var receivedCell =
        document.createElement("td");

    receivedCell.innerHTML =
        formatMoney(record[7]);


    var statusCell =
        document.createElement("td");


    var statusLabel =
        document.createElement("span");

    statusLabel.className =
        "status " +
        getStatusClass(record[10]);

    statusLabel.textContent =
        record[10];


    statusCell.appendChild(
        statusLabel
    );


    var dateCell =
        document.createElement("td");

    dateCell.textContent =
        record[11];


    var actionCell =
        document.createElement("td");


    var actionButtons =
        document.createElement("div");

    actionButtons.className =
        "action-buttons";


    var viewButton =
        document.createElement("button");

    viewButton.className =
        "action-btn view";

    viewButton.innerHTML =
        "View";

    viewButton.onclick =
        createViewFunction(index);


    var updateButton =
        document.createElement("button");

    updateButton.className =
        "action-btn update";

    updateButton.innerHTML =
        "Update";

    updateButton.onclick =
        createUpdateFunction(index);
    if (record[14]) {
        updateButton.disabled = true;
        updateButton.title =
            "Dispatched orders are automatically marked Paid.";
    }


    var archiveButton =
        document.createElement("button");

    archiveButton.className =
        "action-btn archive";

    archiveButton.textContent =
        "Archive";

    archiveButton.onclick =
        createDeleteFunction(index);


    actionButtons.appendChild(
        viewButton
    );

    actionButtons.appendChild(
        updateButton
    );

    actionButtons.appendChild(archiveButton);


    actionCell.appendChild(
        actionButtons
    );


    row.appendChild(paymentCell);
    row.appendChild(orderCell);
    row.appendChild(customerCell);
    row.appendChild(sourceCell);
    row.appendChild(totalCell);
    row.appendChild(receivedCell);
    row.appendChild(statusCell);
    row.appendChild(dateCell);
    row.appendChild(actionCell);


    tableBody.appendChild(row);
}



function createViewFunction(index) {

    return function () {

        viewPayment(index);

    };
}


function viewPayment(index) {

    var record =
        salesPayments[index];


    if (index < 0 || index >= salesPayments.length || record == null) {

        reportError("This payment record is no longer available.");

        return;
    }


    clearReportedError();


    document.getElementById(
        "viewPaymentId"
    ).textContent = record[0];

    document.getElementById(
        "viewOrderId"
    ).textContent = record[1];

    document.getElementById(
        "viewCustomerId"
    ).textContent = record[2];

    document.getElementById(
        "viewCustomerName"
    ).textContent = record[3];

    document.getElementById(
        "viewOrderType"
    ).textContent = record[4];

    document.getElementById(
        "viewSource"
    ).textContent = record[5];

    document.getElementById(
        "viewTotalAmount"
    ).textContent =
        formatMoney(record[6]);

    document.getElementById(
        "viewAmountReceived"
    ).textContent =
        formatMoney(record[7]);

    document.getElementById(
        "viewRemainingBalance"
    ).textContent =
        formatMoney(record[8]);

    document.getElementById(
        "viewPaymentMethod"
    ).textContent = record[9];

    document.getElementById(
        "viewPaymentStatus"
    ).textContent = record[10];

    document.getElementById(
        "viewPaymentDate"
    ).textContent = record[11];

    document.getElementById(
        "viewNotes"
    ).textContent = record[12];


    document.getElementById(
        "viewModal"
    ).classList.add("show");
}



function createUpdateFunction(index) {

    return function () {

        openUpdate(index);

    };
}


function openUpdate(index) {

    if (
        index < 0 ||
        index >= salesPayments.length ||
        salesPayments[index] == null
    ) {

        reportError("This payment record is no longer available.");

        return;
    }


    clearReportedError();

    selectedIndex =
        index;


    var record =
        salesPayments[index];


    document.getElementById(
        "updatePaymentId"
    ).innerHTML = record[0];

    document.getElementById(
        "updateOrderId"
    ).innerHTML = record[1];

    document.getElementById(
        "updateCustomerName"
    ).innerHTML = record[3];

    document.getElementById(
        "updateTotalAmount"
    ).innerHTML =
        formatMoney(record[6]);


    document.getElementById(
        "updateAmountReceived"
    ).value =
        record[7];


    document.getElementById(
        "updateRemainingBalance"
    ).value =
        formatMoney(record[8]);


    document.getElementById(
        "updateMessage"
    ).className =
        "form-message";


    document.getElementById(
        "updateMessage"
    ).innerHTML =
        "";


    document.getElementById(
        "updateModal"
    ).classList.add("show");
}



function saveUpdate() {

    if (
        selectedIndex < 0 ||
        selectedIndex >= salesPayments.length ||
        salesPayments[selectedIndex] == null
    ) {

        reportError("Select an available payment record before saving.");

        return;
    }


    clearReportedError();


    var record =
        salesPayments[selectedIndex];


    var totalAmount =
        record[6];


    var amountText =
        document.getElementById(
            "updateAmountReceived"
        ).value;


    var message =
        document.getElementById(
            "updateMessage"
        );


    message.className =
        "form-message";

    message.innerHTML =
        "";


    if (
        isValidNumberText(
            amountText
        ) == false
    ) {

        message.className =
            "form-message error";

        message.innerHTML =
            "Please enter a valid amount.";

        return;
    }


    var amountReceived =
        textToDecimal(
            amountText
        );


    if (
        amountReceived >
        totalAmount
    ) {

        message.className =
            "form-message error";

        message.innerHTML =
            "Amount received cannot exceed the total amount.";

        return;
    }


    var remainingBalance =
        totalAmount -
        amountReceived;


    var paymentStatus =
        determineStatus(
            totalAmount,
            amountReceived
        );

    try {
        persistPaymentUpdate(record, amountReceived);
    } catch (error) {
        message.className = "form-message error";
        message.textContent = error.message;
        return;
    }


    salesPayments[selectedIndex][7] =
        amountReceived;

    salesPayments[selectedIndex][8] =
        remainingBalance;

    salesPayments[selectedIndex][10] =
        paymentStatus;


    document.getElementById(
        "updateRemainingBalance"
    ).value =
        formatMoney(
            remainingBalance
        );


    renderPayments();

    updateSummary();


    message.className =
        "form-message success";

    message.innerHTML =
        "Payment record updated successfully.";


    window.setTimeout(
        closeUpdateModal,
        500
    );
}


function persistPaymentUpdate(record, amountReceived) {

    var savedOrders =
        window.backendMemoryStorage.getItem(salesOrdersStorageKey);
    var orders =
        savedOrders ? JSON.parse(savedOrders) : [];

    if (!Array.isArray(orders)) {
        throw new Error("Saved customer orders must be an array.");
    }

    var orderIndex = 0;

    while (
        orderIndex < orders.length &&
        getPaymentOrderReference(orders[orderIndex], orderIndex) !==
            String(record[1])
    ) {
        orderIndex = orderIndex + 1;
    }

    if (orderIndex >= orders.length) {
        throw new Error("The connected customer order could not be found.");
    }

    var savedDeliveryStatuses =
        window.backendMemoryStorage.getItem(salesDeliveryStatusStorageKey);
    var deliveryStatuses =
        savedDeliveryStatuses ? JSON.parse(savedDeliveryStatuses) : {};
    var delivery =
        deliveryStatuses[String(record[1])] || {};

    if (/^(dispatched|completed|delivered)$/i.test(String(delivery.status || ""))) {
        throw new Error(
            "Dispatched orders are automatically marked Paid and cannot be changed here."
        );
    }

    orders[orderIndex].amountReceived = amountReceived;
    orders[orderIndex].paymentTransactionId = record[0];
    window.backendMemoryStorage.setItem(
        salesOrdersStorageKey,
        JSON.stringify(orders)
    );
}



function createDeleteFunction(index) {

    return function () {

        deletingIndex =
            index;


        document.getElementById(
            "deleteModal"
        ).classList.add("show");

    };
}


function confirmDelete() {

    if (
        deletingIndex < 0 ||
        deletingIndex >= salesPayments.length ||
        salesPayments[deletingIndex] == null
    ) {

        reportError("Select an available payment record before archiving.");

        return;
    }


    clearReportedError();
    var payment = salesPayments[deletingIndex];
    window.systemArchive.archive(
        "payments",
        payment[0],
        payment[1],
        payment[3] + " · PHP " + payment[6],
        payment
    );


    deletingIndex =
        -1;


    document.getElementById(
        "deleteModal"
    ).classList.remove("show");


    renderPayments();

    updateSummary();
    window.dispatchEvent(new CustomEvent("systemArchiveChanged"));
}



function updateSummary() {

    var totalRevenue = 0;

    var paid = 0;

    var unpaid = 0;

    var i;


    for (
        i = 0;
        i < salesPayments.length;
        i = i + 1
    ) {

        if (window.systemArchive.isArchived("payments", salesPayments[i][0])) {
            continue;
        }

        if (salesPayments[i][13] == true) {
            totalRevenue =
                totalRevenue +
                salesPayments[i][6];
        }


        if (
            salesPayments[i][10] ==
            "Paid"
        ) {

            paid =
                paid + 1;
        }
        else {

            unpaid =
                unpaid + 1;
        }
    }


    document.getElementById(
        "totalRevenue"
    ).innerHTML =
        formatMoney(
            totalRevenue
        );


    document.getElementById(
        "paidCount"
    ).innerHTML =
        paid;


    document.getElementById(
        "unpaidCount"
    ).innerHTML =
        unpaid;
}


function restoreSystemArchivedPayments() {
    var restoredPayments =
        window.systemArchive.getRestored("payments");
    var restoredIndex;
    var paymentIndex;
    var restoredPayment;
    var paymentExists;

    for (
        restoredIndex = 0;
        restoredIndex < restoredPayments.length;
        restoredIndex = restoredIndex + 1
    ) {
        restoredPayment = restoredPayments[restoredIndex];
        if (!Array.isArray(restoredPayment) || restoredPayment.length === 0) {
            throw new Error("A restored payment record is invalid.");
        }

        paymentExists = false;
        for (
            paymentIndex = 0;
            paymentIndex < salesPayments.length;
            paymentIndex = paymentIndex + 1
        ) {
            if (
                String(salesPayments[paymentIndex][0]) ===
                String(restoredPayment[0])
            ) {
                paymentExists = true;
                break;
            }
        }

        if (!paymentExists) {
            salesPayments = window.arrayWithAppended(
                salesPayments,
                restoredPayment
            );
        }
    }
}

try {
    loadSalesPayments();
} catch (error) {
    reportError(error.message);
}

restoreSystemArchivedPayments();

window.addEventListener("systemArchiveChanged", function () {
    restoreSystemArchivedPayments();
    renderPayments();
    updateSummary();
});

window.addEventListener("storage", function (event) {
    if (
        event.key === "jorjetteangel-system-archive" ||
        event.key === salesOrdersStorageKey ||
        event.key === salesDeliveryStatusStorageKey
    ) {
        if (
            event.key === salesOrdersStorageKey ||
            event.key === salesDeliveryStatusStorageKey
        ) {
            try {
                loadSalesPayments();
            } catch (error) {
                reportError(error.message);
            }
        }
        restoreSystemArchivedPayments();
        renderPayments();
        updateSummary();
    }
});



function closeUpdateModal() {

    selectedIndex =
        -1;


    document.getElementById(
        "updateModal"
    ).classList.remove("show");


    document.getElementById(
        "updateMessage"
    ).className =
        "form-message";


    document.getElementById(
        "updateMessage"
    ).innerHTML =
        "";
}



document.getElementById(
    "closeViewModal"
).onclick =
function () {

    document.getElementById(
        "viewModal"
    ).classList.remove("show");

};


document.getElementById(
    "closeViewButton"
).onclick =
function () {

    document.getElementById(
        "viewModal"
    ).classList.remove("show");

};


document.getElementById(
    "closeUpdateModal"
).onclick =
function () {

    closeUpdateModal();

};


document.getElementById(
    "cancelUpdateButton"
).onclick =
function () {

    closeUpdateModal();

};


document.getElementById(
    "saveUpdateButton"
).onclick =
function () {

    saveUpdate();

};


document.getElementById(
    "cancelDeleteButton"
).onclick =
function () {

    deletingIndex =
        -1;


    document.getElementById(
        "deleteModal"
    ).classList.remove("show");

};


document.getElementById(
    "confirmDeleteButton"
).onclick =
function () {

    confirmDelete();

};


document.getElementById(
    "searchPayment"
).oninput =
function () {

    renderPayments();

};


document.getElementById(
    "statusFilter"
).onchange =
function () {

    renderPayments();

};


document.getElementById(
    "sourceFilter"
).onchange =
function () {

    renderPayments();

};


document.getElementById(
    "updateAmountReceived"
).oninput =
function () {

    if (selectedIndex < 0) {
        return;
    }


    var record =
        salesPayments[selectedIndex];


    var amountText =
        document.getElementById(
            "updateAmountReceived"
        ).value;


    if (
        isValidNumberText(
            amountText
        ) == false
    ) {

        document.getElementById(
            "updateRemainingBalance"
        ).value =
            "Invalid";

        return;
    }


    var amountReceived =
        textToDecimal(
            amountText
        );


    if (
        amountReceived >
        record[6]
    ) {

        document.getElementById(
            "updateRemainingBalance"
        ).value =
            "Invalid";

        return;
    }


    var remaining =
        record[6] -
        amountReceived;


    document.getElementById(
        "updateRemainingBalance"
    ).value =
        formatMoney(
            remaining
        );

};



renderPayments();

updateSummary();