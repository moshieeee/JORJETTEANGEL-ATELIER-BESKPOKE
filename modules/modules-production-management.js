// Manages production orders and progress.

var productionRecords = [];

var productionTicketStorageKey =
    "jorjetteangel-production-tickets";

var customerOrdersStorageKey =
    "jorjetteangel-orders";

var productCatalogStorageKey =
    "jorjetteangel-admin-catalog";

var productionBomStorageKey =
    "jg-erp-bom-recipes-v1";

var productionMaterialsStorageKey =
    "jg-erp-fabrics-materials-v1";

var productionAlertsStorageKey =
    "jorjetteangel-admin-alerts";

var productionTicketRegistry = [];
var productionToastTimeout;
var pendingProductionShortages = [];


function showProductionToast(message, isError) {

    var toast = document.getElementById("productionToast");

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.className =
        "production-toast " +
        (isError ? "production-toast-error" : "production-toast-success");

    window.clearTimeout(productionToastTimeout);
    productionToastTimeout = window.setTimeout(function () {
        toast.classList.add("hidden");
    }, 5000);
}


function normalizeProductionSize(size) {

    var normalizedSize =
        String(size || "").trim().toLowerCase();

    if (normalizedSize == "s" || normalizedSize == "small") return "Small";
    if (normalizedSize == "m" || normalizedSize == "medium") return "Medium";
    if (normalizedSize == "l" || normalizedSize == "large") return "Large";
    if (
        normalizedSize == "xl" ||
        normalizedSize == "x-large" ||
        normalizedSize == "extra large"
    ) return "XL";

    return "";
}

function isCustomMeasurementOrder(item) {
    if (
        !item ||
        String(item.size || "").trim().toLowerCase() != "custom" ||
        !item.customMeasurements ||
        typeof item.customMeasurements != "object" ||
        Array.isArray(item.customMeasurements) ||
        Object.keys(item.customMeasurements).length === 0
    ) {
        return false;
    }
    return Object.keys(item.customMeasurements).every(function (name) {
        var value = Number(item.customMeasurements[name]);
        return Number.isFinite(value) && value > 0;
    });
}

function isActiveProductionProduct(productId) {
    var savedCatalog = window.backendMemoryStorage.getItem(productCatalogStorageKey);
    var catalog = savedCatalog ? JSON.parse(savedCatalog) : null;
    return Boolean(
        catalog &&
        Array.isArray(catalog.products) &&
        catalog.products.some(function (product) {
            return product && product.id == productId && product.status != "Archived";
        })
    );
}

function formatCustomMeasurements(item) {
    if (!isCustomMeasurementOrder(item)) {
        return item && item.size ? item.size : "-";
    }
    return "Custom: " + Object.keys(item.customMeasurements).map(function (name) {
        return name + ": " + item.customMeasurements[name];
    }).join(", ");
}

function getMissingProductionBomMessage(item) {

    var productName =
        item && (item.name || item.productName)
            ? item.name || item.productName
            : item && item.productId
                ? item.productId
                : "This item";
    var size =
        item && item.size
            ? String(item.size)
            : "unspecified size";

    return (
        "Cannot start production for " +
        productName +
        " (size " +
        size +
        "): no BOM recipe is defined for this product and size."
    );
}


function normalizeProductionMaterialCode(code) {

    var legacySequence = /^0*(\d+)$/.exec(String(code || ""));
    if (!legacySequence) return String(code || "");

    return "SKU-RAW-" + legacySequence[1].padStart(4, "0");
}


function readProductionArray(storageKey, label) {

    var saved = window.backendMemoryStorage.getItem(storageKey);
    var records = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(records)) {
        throw new Error(label + " data must be an array.");
    }

    return records;
}


function findCompleteProductionBom(productId, size, materials) {

    if (!productId || !normalizeProductionSize(size)) {
        return null;
    }

    var savedCatalog = window.backendMemoryStorage.getItem(productCatalogStorageKey);
    var catalog = savedCatalog ? JSON.parse(savedCatalog) : null;
    if (
        !catalog ||
        !Array.isArray(catalog.products) ||
        !catalog.products.some(function (product) {
            return product && product.id == productId && product.status != "Archived";
        })
    ) {
        return null;
    }

    var recipes = readProductionArray(
        productionBomStorageKey,
        "Saved BOM recipes"
    );
    var normalizedSize = normalizeProductionSize(size);
    var recipeIndex;

    for (recipeIndex = 0; recipeIndex < recipes.length; recipeIndex++) {

        var recipe = recipes[recipeIndex];

        if (
            !recipe ||
            recipe.productId != productId ||
            normalizeProductionSize(recipe.size) != normalizedSize
        ) {
            continue;
        }

        if (!Array.isArray(recipe.materials) || recipe.materials.length === 0) {
            return null;
        }

        var ingredientIndex;
        for (
            ingredientIndex = 0;
            ingredientIndex < recipe.materials.length;
            ingredientIndex++
        ) {
            var ingredient = recipe.materials[ingredientIndex];
            var quantity = Number(ingredient && ingredient.quantity);
            var materialIndex;
            var foundMaterial = false;

            if (
                !ingredient ||
                typeof ingredient.code != "string" ||
                !normalizeProductionMaterialCode(ingredient.code) ||
                !Number.isFinite(quantity) ||
                quantity <= 0
            ) {
                return null;
            }

            for (
                materialIndex = 0;
                materialIndex < materials.length;
                materialIndex++
            ) {
                if (
                    Array.isArray(materials[materialIndex]) &&
                    String(materials[materialIndex][0]) ==
                        normalizeProductionMaterialCode(ingredient.code) &&
                    !window.systemArchive.isArchived(
                        "materials",
                        materials[materialIndex][0]
                    )
                ) {
                    foundMaterial = true;
                    break;
                }
            }

            if (!foundMaterial) {
                return null;
            }
        }

        return recipe;
    }

    return null;
}


function recordCriticalMaterialAlert(orderId, productName, shortage) {

    var alerts;

    try {
        alerts = readProductionArray(
            productionAlertsStorageKey,
            "Dashboard alert"
        );

        var alertId =
            "MATERIAL-SHORTAGE-" + orderId + "-" + shortage.code;
        var existingIndex;

        for (existingIndex = 0; existingIndex < alerts.length; existingIndex++) {
            if (alerts[existingIndex] && alerts[existingIndex].id == alertId) {
                return;
            }
        }

        alerts = window.arrayWithPrepended(alerts, {
            id: alertId,
            severity: "CRITICAL",
            title: "Production material shortage",
            message:
                orderId + ": " + productName + " needs " +
                shortage.required + " " + shortage.unit + " of " +
                shortage.name + " (" + shortage.code + "); only " +
                shortage.available + " " + shortage.unit +
                " is in stock. Submit a production stock request for Cashier approval.",
            role: "Cashier",
            timestamp: new Date().toISOString(),
            acknowledged: false
        });

        window.backendMemoryStorage.setItem(
            productionAlertsStorageKey,
            JSON.stringify(alerts)
        );
    } catch (error) {
        console.error("Could not save the critical material alert.", error);
        throw new Error(
            "Material stock is insufficient, and the dashboard alert could not be saved. " +
            "Resolve the shortage before retrying."
        );
    }
}



var orderRecords = [];

var measurementRecords = [];

var bulkOrderRecords = [];

var materialsInventory = [];

var deliveryRecords = [];


function addCompletedProductionToCatalogStock(record, orderItem, orderKey) {

    var savedCatalog =
        window.backendMemoryStorage.getItem(productCatalogStorageKey);

    var catalog =
        savedCatalog ? JSON.parse(savedCatalog) : null;

    if (
        !catalog ||
        !Array.isArray(catalog.products)
    ) {
        throw new Error("The shared product catalog is unavailable.");
    }

    var productIndex = 0;

    while (
        productIndex < catalog.products.length &&
        catalog.products[productIndex].id != orderItem.productId
    ) {
        productIndex = productIndex + 1;
    }

    if (productIndex >= catalog.products.length) {
        throw new Error("The production product is not linked to an active catalog item.");
    }

    var product =
        catalog.products[productIndex];

    if (product.status == "Archived") {
        throw new Error("Archived products cannot add finished stock.");
    }

    var size =
        String(orderItem.size || "").trim();

    if (!size || size == "-") {
        throw new Error("A size is required before production can add finished stock.");
    }

    if (!Array.isArray(product.finishedGoodsStock)) {
        product.finishedGoodsStock = [];
    }

    var stockIndex = 0;

    while (
        stockIndex < product.finishedGoodsStock.length &&
        String(product.finishedGoodsStock[stockIndex][0]).toUpperCase() !=
            size.toUpperCase()
    ) {
        stockIndex = stockIndex + 1;
    }

    if (stockIndex >= product.finishedGoodsStock.length) {
        product.finishedGoodsStock = window.arrayWithAppended(
            product.finishedGoodsStock,
            [size, 0, []]
        );
    }

    var stockEntry =
        product.finishedGoodsStock[stockIndex];

    if (!Array.isArray(stockEntry[2])) {
        stockEntry[2] = [];
    }

    var alreadyApplied = false;
    var appliedIndex = 0;

    while (appliedIndex < stockEntry[2].length) {
        if (stockEntry[2][appliedIndex] == orderKey) {
            alreadyApplied = true;
            break;
        }
        appliedIndex = appliedIndex + 1;
    }

    if (!alreadyApplied) {
        var quantity =
            Number(record[5]);

        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new Error("Production quantity must be a positive whole number.");
        }

        stockEntry[1] =
            (Number(stockEntry[1]) || 0) + quantity;

        stockEntry[2] = window.arrayWithAppended(stockEntry[2], orderKey);

        product.finishedGoodsUpdatedAt =
            new Date().toLocaleDateString("en-PH");
    }

    window.backendMemoryStorage.setItem(
        productCatalogStorageKey,
        JSON.stringify(catalog)
    );
}



var selectedIndex = -1;

var deletingIndex = -1;

var nextProductionNumber = 1;



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

        digit =
            number % 10;

        number =
            (number - digit) / 10;

        result =
            digitToText(digit) + result;
    }


    return result;
}



function generateProductionID() {

    var numberText =
        integerToText(
            nextProductionNumber
        );

    var productionID =
        "PRD-TKT-";


    if (nextProductionNumber < 10) {

        productionID =
            productionID +
            "000" +
            numberText;

    }

    else if (nextProductionNumber < 100) {

        productionID =
            productionID +
            "00" +
            numberText;

    }

    else if (nextProductionNumber < 1000) {

        productionID =
            productionID +
            "0" +
            numberText;

    }

    else {

        productionID =
            productionID +
            numberText;
    }


    nextProductionNumber =
        nextProductionNumber + 1;


    return productionID;
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


    if (
        textExists(
            record[4],
            searchText
        )
    ) {
        return true;
    }


    return false;
}



function getStatusClass(status) {

    if (
        status ==
        "Pending Production"
    ) {

        return "pending";
    }


    if (
        status == "In Production" ||
        status == "Cutting"
    ) {

        return "production";
    }


    if (
        status ==
        "Completed" ||
        status == "Ready for Delivery"
    ) {

        return "completed";
    }

    if (status == "On Hold") {
        return "hold";
    }


    return "ready";
}



function renderProduction() {

    var tableBody =
        document.getElementById(
            "productionTableBody"
        );


    var searchText =
        document.getElementById(
            "searchProduction"
        ).value;


    var selectedStatus =
        document.getElementById(
            "statusFilter"
        ).value;


    var selectedProduct =
        document.getElementById(
            "productFilter"
        ).value;


    tableBody.innerHTML = "";


    var visibleCount = 0;

    var i;


    for (
        i = 0;
        i < productionRecords.length;
        i = i + 1
    ) {

        if (
            window.systemArchive.isArchived(
                "production",
                productionRecords[i][13] + "::" + productionRecords[i][14]
            )
        ) {
            continue;
        }

        var record =
            productionRecords[i];


        var searchMatch =
            recordMatchesSearch(
                record,
                searchText
            );


        var statusMatch = true;

        var productMatch = true;


        if (
            selectedStatus !=
            "All"
        ) {

            if (
                record[8] !=
                selectedStatus
            ) {

                statusMatch = false;
            }
        }


        if (
            selectedProduct !=
            "All"
        ) {

            if (
                record[4] !=
                selectedProduct
            ) {

                productMatch = false;
            }
        }


        if (
            searchMatch == true &&
            statusMatch == true &&
            productMatch == true
        ) {

            createProductionRow(
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



function createProductionRow(
    tableBody,
    record,
    index
) {

    var row =
        document.createElement("tr");


    var productionCell =
        document.createElement("td");

    productionCell.className =
        "production-id";

    productionCell.textContent =
        record[0];


    var orderCell =
        document.createElement("td");

    orderCell.textContent =
        record[1];


    var customerCell =
        document.createElement("td");

    customerCell.textContent =
        record[3];


    var productCell =
        document.createElement("td");

    productCell.textContent =
        record[4];


    var quantityCell =
        document.createElement("td");

    quantityCell.textContent =
        record[5];


    var statusCell =
        document.createElement("td");


    var statusLabel =
        document.createElement("span");

    statusLabel.className =
        "status " +
        getStatusClass(
            record[8]
        );

    statusLabel.textContent =
        record[8];


    statusCell.appendChild(
        statusLabel
    );


    var receivedDateCell =
        document.createElement("td");

    receivedDateCell.textContent =
        record[9];


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


    var holdButton =
        document.createElement("button");

    holdButton.className =
        "action-btn update";

    holdButton.textContent =
        "Hold";

    holdButton.onclick =
        createDeleteFunction(index);


    actionButtons.appendChild(
        viewButton
    );

    actionButtons.appendChild(
        updateButton
    );

    actionButtons.appendChild(holdButton);


    actionCell.appendChild(
        actionButtons
    );


    row.appendChild(
        productionCell
    );

    row.appendChild(
        orderCell
    );

    row.appendChild(
        customerCell
    );

    row.appendChild(
        productCell
    );

    row.appendChild(
        quantityCell
    );

    row.appendChild(
        statusCell
    );

    row.appendChild(receivedDateCell);

    row.appendChild(
        actionCell
    );


    tableBody.appendChild(row);
}



function createViewFunction(index) {

    return function () {

        viewProduction(index);

    };
}


function viewProduction(index) {

    var record =
        productionRecords[index];


    document.getElementById(
        "viewProductionId"
    ).textContent =
        record[0];


    document.getElementById(
        "viewOrderId"
    ).textContent =
        record[1];


    document.getElementById(
        "viewCustomerId"
    ).textContent =
        record[2];


    document.getElementById(
        "viewCustomerName"
    ).textContent =
        record[3];


    document.getElementById(
        "viewProduct"
    ).textContent =
        record[4];


    document.getElementById(
        "viewQuantity"
    ).textContent =
        record[5];


    document.getElementById(
        "viewMeasurements"
    ).textContent =
        record[6];


    document.getElementById(
        "viewMaterials"
    ).textContent =
        record[7];


    document.getElementById(
        "viewStatus"
    ).textContent =
        record[8];


    document.getElementById(
        "viewStaff"
    ).textContent =
        record[11];


    document.getElementById(
        "viewStartDate"
    ).textContent =
        record[9];


    document.getElementById(
        "viewCompletionDate"
    ).textContent =
        record[10];


    document.getElementById(
        "viewNotes"
    ).textContent =
        record[12];


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

    selectedIndex =
        index;


    var record =
        productionRecords[index];


    document.getElementById(
        "updateProductionId"
    ).innerHTML =
        record[0];


    document.getElementById(
        "updateOrderId"
    ).innerHTML =
        record[1];


    document.getElementById(
        "updateCustomerName"
    ).innerHTML =
        record[3];


    document.getElementById(
        "updateProduct"
    ).innerHTML =
        record[4];


    document.getElementById(
        "updateStatus"
    ).value =
        record[8];


    document.getElementById(
        "updateStaff"
    ).value =
        record[11];


    document.getElementById(
        "updateNotes"
    ).value =
        record[12];


    document.getElementById(
        "updateMessage"
    ).className =
        "form-message";


    document.getElementById(
        "updateMessage"
    ).innerHTML =
        "";


    renderCustomMeasurementFields(record);
    pendingProductionShortages = [];
    document.getElementById("requestProductionStockButton").hidden = true;

    document.getElementById(
        "updateModal"
    ).classList.add("show");
}

function getProductionOrderLine(record) {
    var savedOrders = window.backendMemoryStorage.getItem(customerOrdersStorageKey);
    var orders = savedOrders ? JSON.parse(savedOrders) : [];
    if (!Array.isArray(orders)) {
        throw new Error("Saved customer orders must be an array.");
    }
    var orderIndex = orders.findIndex(function (order) {
        return order && (order.reference || order.orderId) == record[13];
    });
    if (
        orderIndex < 0 ||
        !Array.isArray(orders[orderIndex].items) ||
        !orders[orderIndex].items[record[14]]
    ) {
        throw new Error("The connected customer order line could not be found.");
    }
    return {
        orders: orders,
        item: orders[orderIndex].items[record[14]]
    };
}

function renderCustomMeasurementFields(record) {
    var group = document.getElementById("customMeasurementGroup");
    var container = document.getElementById("customMeasurementFields");
    var message = document.getElementById("customMeasurementMessage");
    container.replaceChildren();
    message.textContent = "";

    var line;
    try {
        line = getProductionOrderLine(record);
    } catch (error) {
        group.hidden = true;
        return;
    }
    if (!isCustomMeasurementOrder(line.item)) {
        group.hidden = true;
        return;
    }

    group.hidden = false;
    Object.keys(line.item.customMeasurements).forEach(function (name) {
        var label = document.createElement("label");
        label.className = "custom-measurement-field";
        label.textContent = name;
        var input = document.createElement("input");
        input.type = "number";
        input.step = "any";
        input.min = "0.01";
        input.value = String(line.item.customMeasurements[name]);
        input.setAttribute("aria-label", name + " measurement");
        input.addEventListener("change", function () {
            var measurement = Number(input.value);
            if (!Number.isFinite(measurement) || measurement <= 0) {
                message.textContent = "Enter a measurement greater than zero.";
                return;
            }
            try {
                var currentLine = getProductionOrderLine(record);
                currentLine.item.customMeasurements = Object.assign(
                    {},
                    currentLine.item.customMeasurements,
                    { [name]: measurement }
                );
                window.backendMemoryStorage.setItem(
                    customerOrdersStorageKey,
                    JSON.stringify(currentLine.orders)
                );
                record[6] = formatCustomMeasurements(currentLine.item);
                renderProduction();
                message.textContent = "Measurement saved automatically.";
            } catch (error) {
                console.error("Could not save the custom order measurement.", error);
                message.textContent = error.message;
            }
        });
        label.appendChild(input);
        container.appendChild(label);
    });
}

function requestProductionStock() {
    if (selectedIndex < 0 || !pendingProductionShortages.length) {
        throw new Error("No production material shortage is available to request.");
    }
    var record = productionRecords[selectedIndex];
    var requestKey = "jg-erp-purchase-restock-requests-v1";
    var savedRequests = window.backendMemoryStorage.getItem(requestKey);
    var requests = savedRequests ? JSON.parse(savedRequests) : [];
    if (!Array.isArray(requests)) {
        throw new Error("Saved material purchase requests must be a list.");
    }
    var savedSession = window.backendMemoryStorage.getItem("jorjetteangel-admin-session");
    var session = savedSession ? JSON.parse(savedSession) : null;
    if (!session || typeof session != "object") session = {};
    var requester =
        [session.firstName, session.lastName].filter(Boolean).join(" ") ||
        session.email ||
        "Atelier Staff";
    var created = 0;
    var alreadyRequested = false;

    pendingProductionShortages.forEach(function (shortage, index) {
        var requestedQuantity =
            Number(shortage.required) - Number(shortage.available);
        if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) return;
        var exists = requests.some(function (request) {
            return request &&
                request.materialSku == shortage.code &&
                request.orderReference == record[13] &&
                ["Requested", "Waiting for Cashier Approval", "Approved"].includes(
                    request.status
                );
        });
        if (exists) {
            alreadyRequested = true;
            return;
        }
        requests = window.arrayWithAppended(requests, {
            id: "PROD-" + Date.now() + "-" + index,
            materialSku: shortage.code,
            materialName: shortage.name,
            category: "Production material",
            quantityOnHand: Number(shortage.available) || 0,
            requestedQuantity: requestedQuantity,
            unit: shortage.unit || "units",
            reorderThreshold: Number(shortage.required) || requestedQuantity,
            requestedBy: requester,
            targetRole: "Cashier",
            source: "production-shortage",
            orderReference: record[13],
            productName: record[4],
            status: "Waiting for Cashier Approval",
            requestedAt: new Date().toISOString()
        });
        created += 1;
    });
    if (!created && !alreadyRequested) {
        throw new Error("A matching material purchase request is already awaiting review.");
    }

    var previousRequests = window.backendMemoryStorage.getItem(requestKey);
    try {
        window.backendMemoryStorage.setItem(requestKey, JSON.stringify(requests));
        var notes = document.getElementById("updateNotes").value.trim();
        notes = (notes ? notes + " " : "") +
            "On hold: stock request sent to Cashier for " + record[13] + ".";
        persistProductionUpdate(
            record,
            "On Hold",
            document.getElementById("updateStaff").value,
            notes
        );
    } catch (error) {
        try {
            if (previousRequests === null) window.backendMemoryStorage.removeItem(requestKey);
            else window.backendMemoryStorage.setItem(requestKey, previousRequests);
        } catch (rollbackError) {
            console.error("Could not roll back the production stock request.", rollbackError);
        }
        throw error;
    }

    record[8] = "On Hold";
    record[12] = notes;
    document.getElementById("updateStatus").value = "On Hold";
    document.getElementById("updateNotes").value = notes;
    pendingProductionShortages = [];
    document.getElementById("requestProductionStockButton").hidden = true;
    renderProduction();
    updateSummary();
    showProductionToast(
        "Stock request sent to Cashier. Production ticket is now On Hold.",
        false
    );
}



function persistProductionUpdate(record, status, staff, notes) {

    var savedOrders =
        window.backendMemoryStorage.getItem(customerOrdersStorageKey);

    var orders =
        savedOrders ? JSON.parse(savedOrders) : [];

    if (!Array.isArray(orders)) {
        throw new Error("Saved customer orders must be an array.");
    }

    var orderIndex = 0;

    while (
        orderIndex < orders.length &&
        (orders[orderIndex].reference || orders[orderIndex].orderId) != record[13]
    ) {
        orderIndex = orderIndex + 1;
    }

    if (
        orderIndex >= orders.length ||
        !Array.isArray(orders[orderIndex].items) ||
        !orders[orderIndex].items[record[14]]
    ) {
        throw new Error("The connected customer order line could not be found.");
    }

    var orderItem =
        orders[orderIndex].items[record[14]];
    var priorMaterials =
        window.backendMemoryStorage.getItem(productionMaterialsStorageKey);
    var priorCatalog =
        window.backendMemoryStorage.getItem(productCatalogStorageKey);
    var priorOrders = savedOrders;
    var entersCutting =
        !orderItem.materialsDeducted &&
        (
            (
                status == "Cutting" &&
                orderItem.productionStatus != "Cutting"
            ) ||
            (
                status == "In Production" &&
                orderItem.productionStatus != "Cutting" &&
                orderItem.productionStatus != "In Production"
            )
        );

    try {
        if (entersCutting) {
            var materials = readProductionArray(
                productionMaterialsStorageKey,
                "Raw material inventory"
            );
            var recipe = findCompleteProductionBom(
                orderItem.productId,
                orderItem.size,
                materials
            );

            if (
                !recipe &&
                (!isCustomMeasurementOrder(orderItem) ||
                    !isActiveProductionProduct(orderItem.productId))
            ) {
                throw new Error(getMissingProductionBomMessage(orderItem));
            }

            if (recipe) {
                var quantity = Number(orderItem.quantity == null ? 1 : orderItem.quantity);
                if (!Number.isInteger(quantity) || quantity < 1) {
                    throw new Error("Production quantity must be a positive whole number.");
                }

                var requiredByCode = {};
                recipe.materials.forEach(function (ingredient) {
                    var required = Number(ingredient.quantity) * quantity;
                    var code = normalizeProductionMaterialCode(ingredient.code);
                    requiredByCode[code] =
                        (requiredByCode[code] || 0) + required;
                });

                var shortages = [];
                Object.keys(requiredByCode).forEach(function (code) {
                    var materialIndex = materials.findIndex(function (material) {
                        return (
                            Array.isArray(material) &&
                            String(material[0]) == code &&
                            !window.systemArchive.isArchived("materials", material[0])
                        );
                    });
                    var material = materialIndex >= 0 ? materials[materialIndex] : null;
                    var available = material ? Number(material[4]) : 0;
                    var required = requiredByCode[code];

                    if (
                        !material ||
                        !/^SKU-(RAW|ACC)-/i.test(code) ||
                        !Number.isFinite(available) ||
                        available < required
                    ) {
                        shortages = window.arrayWithAppended(shortages, {
                            code: code,
                            name: material ? String(material[1]) : code,
                            unit: material ? String(material[5] || "units") : "units",
                            required: required,
                            available: Number.isFinite(available) ? available : 0
                        });
                    }
                });

                if (shortages.length) {
                    shortages.forEach(function (shortage) {
                        recordCriticalMaterialAlert(
                            String(record[1]),
                            String(record[4]),
                            shortage
                        );
                    });
                    var shortageError = new Error(
                        "Insufficient material stock: " +
                        shortages.map(function (shortage) {
                            return shortage.name + " (" + shortage.code + "): " +
                                shortage.available + " " + shortage.unit +
                                " available; " + shortage.required + " required.";
                        }).join(" ")
                    );
                    shortageError.shortages = shortages;
                    throw shortageError;
                }

                Object.keys(requiredByCode).forEach(function (code) {
                    var material = materials.find(function (entry) {
                        return Array.isArray(entry) && String(entry[0]) == code;
                    });
                    material[4] = Number(material[4]) - requiredByCode[code];
                });

                orderItem.materialsDeducted = true;
                orderItem.materialsDeductedAt = new Date().toISOString();
                window.backendMemoryStorage.setItem(
                    productionMaterialsStorageKey,
                    JSON.stringify(materials)
                );
            }
        }

        if (
            (status == "Completed" || status == "Ready for Delivery") &&
            !orderItem.finishedStockAdded &&
            !isCustomMeasurementOrder(orderItem)
        ) {
            addCompletedProductionToCatalogStock(
                record,
                orderItem,
                record[13] + "::" + record[14]
            );
            orderItem.finishedStockAdded = true;
        }

        orderItem.productionStatus = status;
        orderItem.productionStaff = staff;
        orderItem.productionNotes = notes;

        if (status == "Completed" || status == "Ready for Delivery") {
            orderItem.productionCompletionDate = getCurrentDate();
        }

        window.backendMemoryStorage.setItem(
            customerOrdersStorageKey,
            JSON.stringify(orders)
        );
    } catch (error) {
        try {
            if (priorMaterials === null) {
                window.backendMemoryStorage.removeItem(productionMaterialsStorageKey);
            } else {
                window.backendMemoryStorage.setItem(productionMaterialsStorageKey, priorMaterials);
            }
            if (priorCatalog === null) {
                window.backendMemoryStorage.removeItem(productCatalogStorageKey);
            } else {
                window.backendMemoryStorage.setItem(productCatalogStorageKey, priorCatalog);
            }
            if (priorOrders === null) {
                window.backendMemoryStorage.removeItem(customerOrdersStorageKey);
            } else {
                window.backendMemoryStorage.setItem(customerOrdersStorageKey, priorOrders);
            }
        } catch (rollbackError) {
            console.error("Could not roll back a failed production update.", rollbackError);
            throw new Error(
                error.message + " Inventory rollback failed; verify stock records before retrying."
            );
        }
        throw error;
    }
}


function saveUpdate() {

    if (selectedIndex < 0) {
        return;
    }


    var record =
        productionRecords[selectedIndex];


    var newStatus =
        document.getElementById(
            "updateStatus"
        ).value;


    var newStaff =
        document.getElementById(
            "updateStaff"
        ).value;


    var newNotes =
        document.getElementById(
            "updateNotes"
        ).value;


    var message =
        document.getElementById(
            "updateMessage"
        );


    message.className =
        "form-message";

    message.innerHTML =
        "";


    try {
        persistProductionUpdate(
            record,
            newStatus,
            newStaff,
            newNotes
        );
    } catch (error) {
        console.error("Could not update connected production stock.", error);
        message.className = "form-message error";
        message.textContent = error.message;
        pendingProductionShortages =
            Array.isArray(error.shortages) ? error.shortages : [];
        document.getElementById("requestProductionStockButton").hidden =
            pendingProductionShortages.length === 0;
        showProductionToast(error.message, true);
        return;
    }

    productionRecords[selectedIndex][8] =
        newStatus;

    productionRecords[selectedIndex][11] =
        newStaff;

    productionRecords[selectedIndex][12] =
        newNotes;

    if (
        newStatus == "Completed" ||
        newStatus == "Ready for Delivery"
    ) {
        productionRecords[selectedIndex][10] =
            getCurrentDate();
    }


    message.className =
        "form-message success";

    var customWithoutRecipe = false;
    try {
        var updatedLine = getProductionOrderLine(record);
        customWithoutRecipe =
            isCustomMeasurementOrder(updatedLine.item) &&
            !findCompleteProductionBom(
                updatedLine.item.productId,
                updatedLine.item.size,
                readProductionArray(
                    productionMaterialsStorageKey,
                    "Raw material inventory"
                )
            );
    } catch (error) {
        console.error("Could not verify the custom order BOM after updating.", error);
    }
    message.textContent = customWithoutRecipe
        ? "Production record updated. No custom-size BOM exists, so raw-material stock was not deducted."
        : "Production record updated successfully.";
    showProductionToast(message.textContent, false);


    renderProduction();

    updateSummary();


    window.setTimeout(
        closeUpdateModal,
        500
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

    if (deletingIndex < 0) {
        return;
    }

    var record = productionRecords[deletingIndex];
    try {
        persistProductionUpdate(
            record,
            "On Hold",
            record[11],
            record[12]
        );
    } catch (error) {
        console.error("Could not hold production.", error);
        showProductionToast(error.message, true);
        return;
    }

    productionRecords[deletingIndex][8] = "On Hold";

    deletingIndex =
        -1;


    document.getElementById(
        "deleteModal"
    ).classList.remove("show");


    renderProduction();

    updateSummary();
    showProductionToast("Production put on hold.", false);
}



function updateSummary() {

    var total = 0;

    var pending = 0;

    var production = 0;

    var completed = 0;

    var i;


    for (
        i = 0;
        i < productionRecords.length;
        i = i + 1
    ) {

        if (
            window.systemArchive.isArchived(
                "production",
                productionRecords[i][13] + "::" + productionRecords[i][14]
            )
        ) {
            continue;
        }

        total =
            total + 1;


        if (
            productionRecords[i][8] ==
                "Pending Production" ||
            productionRecords[i][8] ==
                "Received" ||
            productionRecords[i][8] ==
                "On Hold"
        ) {

            pending =
                pending + 1;
        }

        else if (
            productionRecords[i][8] == "In Production" ||
            productionRecords[i][8] == "Cutting"
        ) {

            production =
                production + 1;
        }

        else if (
            productionRecords[i][8] ==
                "Completed" ||
            productionRecords[i][8] ==
                "Ready for Delivery"
        ) {

            completed =
                completed + 1;
        }
    }


    document.getElementById(
        "totalOrders"
    ).innerHTML =
        total;


    document.getElementById(
        "pendingCount"
    ).innerHTML =
        pending;


    document.getElementById(
        "productionCount"
    ).innerHTML =
        production;


    document.getElementById(
        "completedCount"
    ).innerHTML =
        completed;
}



function getCurrentDate() {

    var dateText =
        Date();

    var monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    var monthNumbers = [
        "01", "02", "03", "04", "05", "06",
        "07", "08", "09", "10", "11", "12"
    ];

    var monthIndex = 0;

    while (
        monthIndex < monthNames.length &&
        dateText[4] + dateText[5] + dateText[6] !== monthNames[monthIndex]
    ) {
        monthIndex = monthIndex + 1;
    }

    var year =
        (dateText[11] - "0") * 1000 +
        (dateText[12] - "0") * 100 +
        (dateText[13] - "0") * 10 +
        (dateText[14] - "0");

    var day;

    if (dateText[8] === " ") {
        day = dateText[9] - "0";
    } else {
        day =
            (dateText[8] - "0") * 10 +
            (dateText[9] - "0");
    }

    var monthText =
        monthNumbers[monthIndex];

    var dayText =
        integerToText(day);


    if (day < 10) {

        dayText =
            "0" + dayText;
    }


    return year +
        "-" +
        monthText +
        "-" +
        dayText;
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
    "requestProductionStockButton"
).onclick =
function () {
    var message = document.getElementById("updateMessage");
    try {
        requestProductionStock();
        message.className = "form-message success";
        message.textContent =
            "Stock request sent to Cashier. Production ticket is On Hold.";
    } catch (error) {
        console.error("Could not submit the production stock request.", error);
        message.className = "form-message error";
        message.textContent = error.message;
    }
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
    "searchProduction"
).oninput =
function () {

    renderProduction();

};



document.getElementById(
    "statusFilter"
).onchange =
function () {

    renderProduction();

};



document.getElementById(
    "productFilter"
).onchange =
function () {

    renderProduction();

};



function findProductionTicket(orderKey) {

    var i;

    for (
        i = 0;
        i < productionTicketRegistry.length;
        i = i + 1
    ) {
        if (productionTicketRegistry[i].orderKey == orderKey) {
            return productionTicketRegistry[i].ticketId;
        }
    }

    return "";
}


function formatReceivedDate(dateValue) {

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


function loadProductionOrders() {

    var savedOrders =
        window.backendMemoryStorage.getItem(customerOrdersStorageKey);

    var orders =
        savedOrders ? JSON.parse(savedOrders) : [];

    if (!Array.isArray(orders)) {
        throw new Error("Saved customer orders must be an array.");
    }

    var materialsForBoms;
    try {
        materialsForBoms = readProductionArray(
            productionMaterialsStorageKey,
            "Raw material inventory"
        );
    } catch (error) {
        showProductionToast(error.message, true);
        return;
    }

    var savedTickets =
        window.backendMemoryStorage.getItem(productionTicketStorageKey);

    productionTicketRegistry =
        savedTickets ? JSON.parse(savedTickets) : [];

    if (!Array.isArray(productionTicketRegistry)) {
        throw new Error("Saved production ticket registry must be an array.");
    }

    var highestTicketNumber = 0;
    var ticketPattern = /^PRD-TKT-(\d{4,})$/;
    var registryIndex;

    for (
        registryIndex = 0;
        registryIndex < productionTicketRegistry.length;
        registryIndex = registryIndex + 1
    ) {
        var ticketMatch = ticketPattern.exec(
            productionTicketRegistry[registryIndex].ticketId
        );

        if (ticketMatch) {
            var ticketNumber = Number(ticketMatch[1]);

            if (Number.isSafeInteger(ticketNumber)) {
                highestTicketNumber =
                    Math.max(highestTicketNumber, ticketNumber);
            }
        }
    }

    nextProductionNumber = highestTicketNumber + 1;
    productionRecords = [];
    var registryChanged = false;
    var orderIndex;

    for (
        orderIndex = 0;
        orderIndex < orders.length;
        orderIndex = orderIndex + 1
    ) {
        var order = orders[orderIndex];

        if (!order || typeof order !== "object") {
            throw new Error("Each saved customer order must be an object.");
        }

        if (!Array.isArray(order.items)) {
            continue;
        }

        var orderReference =
            order.reference || order.orderId || "ORDER-" + (orderIndex + 1);

        var customer =
            order.customer && typeof order.customer === "object"
                ? order.customer
                : {};

        var itemIndex;

        for (
            itemIndex = 0;
            itemIndex < order.items.length;
            itemIndex = itemIndex + 1
        ) {
            var item = order.items[itemIndex];

            if (!item || typeof item !== "object") {
                throw new Error("Each customer order item must be an object.");
            }

            var completeBom;
            try {
                completeBom = findCompleteProductionBom(
                    item.productId,
                    item.size,
                    materialsForBoms
                );
            } catch (error) {
                showProductionToast(error.message, true);
                return;
            }
            if (
                !completeBom &&
                (!isCustomMeasurementOrder(item) ||
                    !isActiveProductionProduct(item.productId))
            ) {
                showProductionToast(
                    getMissingProductionBomMessage(item),
                    true
                );
                continue;
            }

            var orderKey =
                orderReference + "::" + itemIndex;

            if (window.systemArchive.isArchived("production", orderKey)) {
                continue;
            }

            var productionTicket =
                findProductionTicket(orderKey);

            if (!productionTicket) {
                productionTicket = generateProductionID();
                productionTicketRegistry = window.arrayWithAppended(
                    productionTicketRegistry,
                    {
                        orderKey: orderKey,
                        ticketId: productionTicket
                    }
                );
                registryChanged = true;
            }

            productionRecords = window.arrayWithAppended(productionRecords, [
                productionTicket,
                item.orderId || orderReference,
                customer.id || customer.email || order.accountEmail || "-",
                customer.name || order.customerName || "-",
                item.name || item.productName || "Item",
                item.quantity == null ? 1 : item.quantity,
                formatCustomMeasurements(item),
                item.materialsRequired || "-",
                item.productionStatus || order.status || "Received",
                formatReceivedDate(order.createdAt || order.receivedAt),
                item.productionCompletionDate || "-",
                item.productionStaff || "-",
                order.deliveryAddress && order.deliveryAddress.notes
                    ? order.deliveryAddress.notes
                    : item.productionNotes || "-",
                orderReference,
                itemIndex,
                item.productId || ""
            ]);
        }
    }

    if (registryChanged) {
        window.backendMemoryStorage.setItem(
            productionTicketStorageKey,
            JSON.stringify(productionTicketRegistry)
        );
    }

    updateProductionFilters();
}


function updateProductionFilters() {

    var productFilter =
        document.getElementById("productFilter");

    var selectedProduct =
        productFilter.value;

    productFilter.replaceChildren();

    var allProductsOption =
        document.createElement("option");

    allProductsOption.value = "All";
    allProductsOption.textContent = "All Products";
    productFilter.appendChild(allProductsOption);

    var i;

    for (
        i = 0;
        i < productionRecords.length;
        i = i + 1
    ) {
        var productName = productionRecords[i][4];
        var productExists = false;
        var optionIndex;

        for (
            optionIndex = 0;
            optionIndex < productFilter.options.length;
            optionIndex = optionIndex + 1
        ) {
            if (productFilter.options[optionIndex].value == productName) {
                productExists = true;
                break;
            }
        }

        if (!productExists) {
            var productOption =
                document.createElement("option");

            productOption.value = productName;
            productOption.textContent = productName;
            productFilter.appendChild(productOption);
        }
    }

    var selectedProductExists =
        selectedProduct == "All";
    var selectedOptionIndex;

    for (
        selectedOptionIndex = 0;
        selectedOptionIndex < productFilter.options.length;
        selectedOptionIndex = selectedOptionIndex + 1
    ) {
        if (
            productFilter.options[selectedOptionIndex].value ==
            selectedProduct
        ) {
            selectedProductExists = true;
        }
    }

    productFilter.value =
        selectedProductExists ? selectedProduct : "All";

    var statusFilter =
        document.getElementById("statusFilter");

    for (
        i = 0;
        i < productionRecords.length;
        i = i + 1
    ) {
        var orderStatus = productionRecords[i][8];
        var statusExists = false;
        var statusIndex;

        for (
            statusIndex = 0;
            statusIndex < statusFilter.options.length;
            statusIndex = statusIndex + 1
        ) {
            if (statusFilter.options[statusIndex].value == orderStatus) {
                statusExists = true;
                break;
            }
        }

        if (!statusExists) {
            var statusOption =
                document.createElement("option");

            statusOption.value = orderStatus;
            statusOption.textContent = orderStatus;
            statusFilter.appendChild(statusOption);
        }
    }
}



loadProductionOrders();

renderProduction();

updateSummary();

window.addEventListener("storage", function (event) {
    if (
        event.key === customerOrdersStorageKey ||
        event.key === productionBomStorageKey ||
        event.key === productionMaterialsStorageKey ||
        event.key === productCatalogStorageKey ||
        event.key === "jorjetteangel-system-archive" ||
        event.key === null
    ) {
        loadProductionOrders();
        renderProduction();
        updateSummary();
    }
});

window.addEventListener("systemArchiveChanged", function () {
    renderProduction();
    updateSummary();
});