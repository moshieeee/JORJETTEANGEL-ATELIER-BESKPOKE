// Manages supplier records.

var suppliers = [];
var supplierDirectoryStorageKey = "jg-erp-supplier-directory-v1";

function loadSupplierDirectory() {
    var savedSuppliers = window.backendMemoryStorage.getItem(supplierDirectoryStorageKey);
    if (savedSuppliers === null) {
        suppliers = [];
        return;
    }

    var parsedSuppliers = JSON.parse(savedSuppliers);
    if (!Array.isArray(parsedSuppliers) ||
        parsedSuppliers.some(function (supplier) {
            return !Array.isArray(supplier) || supplier.length < 7;
        })) {
        throw new Error("Saved supplier directory data is invalid.");
    }
    suppliers = parsedSuppliers;
}

function saveSupplierDirectory() {
    try {
        window.backendMemoryStorage.setItem(
            supplierDirectoryStorageKey,
            JSON.stringify(suppliers)
        );
        return true;
    } catch (error) {
        reportError("Supplier directory changes could not be saved.");
        return false;
    }
}



var purchasingRequests = [];

var materialsInventory = [];

var productionRecords = [];



var selectedIndex = -1;

var deletingIndex = -1;

var viewingSupplierIndex = -1;

var nextSupplierNumber = 1;



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



function makeLowercase(text) {

    var upper = [
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
    ];

    var lower = [
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
        "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"
    ];

    var result = "";

    var position = 0;

    var character = "";

    var letterIndex = 0;

    var found = false;


    while (position < text.length) {

        character = text[position];
        letterIndex = 0;
        found = false;

        while (letterIndex < upper.length) {

            if (character === upper[letterIndex]) {
                result = result + lower[letterIndex];
                found = true;
                break;
            }

            letterIndex = letterIndex + 1;
        }

        if (found === false) {
            result = result + character;
        }


        position++;

    }


    return result;
}


function containsText(mainText, searchText) {

    var text =
        makeLowercase(mainText);

    var search =
        makeLowercase(searchText);

    var position = 0;

    var match = true;


    if (search.length === 0) {

        return true;

    }


    if (search.length > text.length) {

        return false;

    }


    while (
        position <=
        text.length - search.length
    ) {

        var checkPosition = 0;

        match = true;


        while (
            checkPosition <
            search.length
        ) {

            if (
                text[position + checkPosition]
                !==
                search[checkPosition]
            ) {

                match = false;

                break;

            }


            checkPosition++;

        }


        if (match === true) {

            return true;

        }


        position++;

    }


    return false;
}


function containsOnlyDigits(text) {

    var position = 0;

    var character;


    if (text === "") {

        return false;

    }


    while (position < text.length) {

        character = text[position];


        if (
            character < "0" ||
            character > "9"
        ) {

            return false;

        }


        position++;

    }


    return true;
}


function filterContactNumber(input) {

    var originalText = input.value;

    var filteredText = "";

    var position = 0;

    var character;


    while (
        position < originalText.length &&
        filteredText.length < 11
    ) {

        character = originalText[position];


        if (
            character >= "0" &&
            character <= "9"
        ) {

            filteredText = filteredText + character;

        }


        position++;

    }


    input.value = filteredText;
}



function generateSupplierID() {

    var largestExistingNumber = 0;

    var index = 0;

    while (index < suppliers.length) {

        var match =
            /^SUP-VND-(\d{4,})$/.exec(
                String(suppliers[index][0] || "")
            );

        if (match !== null) {
            var existingNumber = Number(match[1]);

            if (existingNumber > largestExistingNumber) {
                largestExistingNumber = existingNumber;
            }
        }

        index++;
    }

    if (nextSupplierNumber <= largestExistingNumber) {
        nextSupplierNumber = largestExistingNumber + 1;
    }

    var numberText =
        String(nextSupplierNumber);

    while (numberText.length < 4) {
        numberText = "0" + numberText;
    }

    nextSupplierNumber++;

    return "SUP-VND-" + numberText;
}



function openCreateModal() {

    document.getElementById(
        "createSupplierName"
    ).value = "";

    document.getElementById(
        "createTaxId"
    ).value = "";

    document.getElementById(
        "createContactPerson"
    ).value = "";

    document.getElementById(
        "createContactNumber"
    ).value = "";

    document.getElementById(
        "createAddress"
    ).value = "";

    document.getElementById(
        "createEmail"
    ).value = "";

    document.getElementById(
        "createMaterials"
    ).value = "";

    document.getElementById(
        "createStatus"
    ).value = "Active";


    document.getElementById(
        "createMessage"
    ).textContent = "";

    document.getElementById(
        "createMessage"
    ).className =
        "form-message";


    document.getElementById(
        "createModal"
    ).classList.add("show");

}


function saveNewSupplier() {

    var supplierName =
        document.getElementById(
            "createSupplierName"
        ).value;

    var contactNumber =
        document.getElementById(
            "createContactNumber"
        ).value;

    var address =
        document.getElementById(
            "createAddress"
        ).value;

    var email =
        document.getElementById(
            "createEmail"
        ).value;

    var materials =
        document.getElementById(
            "createMaterials"
        ).value;

    var taxId =
        document.getElementById(
            "createTaxId"
        ).value;

    var contactPerson =
        document.getElementById(
            "createContactPerson"
        ).value;

    var status =
        document.getElementById(
            "createStatus"
        ).value;


    var message =
        document.getElementById(
            "createMessage"
        );



    if (supplierName === "") {

        message.textContent =
            "Supplier name is required.";

        message.className =
            "form-message error";

        return;

    }


    if (contactNumber === "") {

        message.textContent =
            "Contact number is required.";

        message.className =
            "form-message error";

        return;

    }


    if (containsOnlyDigits(contactNumber) === false) {

        message.textContent =
            "Contact number must contain digits only, with no spaces.";

        message.className =
            "form-message error";

        return;

    }


    if (contactNumber.length !== 11) {

        message.textContent =
            "Contact number must be exactly 11 digits.";

        message.className =
            "form-message error";

        return;

    }


    if (address === "") {

        message.textContent =
            "Address is required.";

        message.className =
            "form-message error";

        return;

    }


    if (email === "") {

        message.textContent =
            "Email is required.";

        message.className =
            "form-message error";

        return;

    }


    if (materials === "") {

        message.textContent =
            "Materials supplied is required.";

        message.className =
            "form-message error";

        return;

    }



    var supplierID =
        generateSupplierID();



    var newSupplier = [

        supplierID,

        supplierName,

        contactNumber,

        address,

        email,

        materials,

        status,

        taxId,

        contactPerson

    ];



    suppliers[suppliers.length] =
        newSupplier;

    if (!saveSupplierDirectory()) {
        suppliers = window.arrayWithoutLast(suppliers);
        return;
    }

    message.textContent =
        "Supplier added successfully.";

    message.className =
        "form-message success";


    renderSuppliers(
        document.getElementById(
            "searchSupplier"
        ).value
    );


    setTimeout(
        function() {

            closeCreateModal();

        },
        500
    );

}



function searchSuppliers() {

    var searchInput =
        document.getElementById(
            "searchSupplier"
        );

    var searchText =
        searchInput.value;


    renderSuppliers(searchText);

}


function renderSuppliers(searchText) {

    var tableBody =
        document.getElementById(
            "supplierTableBody"
        );

    var emptyMessage =
        document.getElementById(
            "emptyMessage"
        );


    tableBody.innerHTML = "";


    var displayedCount = 0;

    var index = 0;


    while (
        index <
        suppliers.length
    ) {

        var supplier =
            suppliers[index];

        if (window.systemArchive.isArchived("suppliers", supplier[0])) {
            index++;
            continue;
        }

        var supplierID =
            supplier[0];

        var supplierName =
            supplier[1];

        var contactNumber =
            supplier[2];

        var address =
            supplier[3];

        var email =
            supplier[4];

        var materials =
            supplier[5];


        var matches = false;


        if (searchText === "") {

            matches = true;

        } else {

            if (
                containsText(
                    supplierID,
                    searchText
                )
            ) {

                matches = true;

            }


            if (
                containsText(
                    supplierName,
                    searchText
                )
            ) {

                matches = true;

            }


            if (
                containsText(
                    contactNumber,
                    searchText
                )
            ) {

                matches = true;

            }


            if (
                containsText(
                    address,
                    searchText
                )
            ) {

                matches = true;

            }


            if (
                containsText(
                    email,
                    searchText
                )
            ) {

                matches = true;

            }


            if (
                containsText(
                    materials,
                    searchText
                )
            ) {

                matches = true;

            }

        }


        if (matches === true) {

            var row =
                document.createElement("tr");


            var idCell =
                document.createElement("td");

            idCell.className =
                "supplier-id";

            idCell.textContent =
                supplierID;


            var nameCell =
                document.createElement("td");

            nameCell.className = "company-cell";
            var supplierLink =
                document.createElement("button");
            supplierLink.type = "button";
            supplierLink.className = "supplier-profile-link";
            supplierLink.textContent = supplierName;
            supplierLink.onclick = createViewHandler(index);
            nameCell.appendChild(supplierLink);


            var contactCell =
                document.createElement("td");

            contactCell.className = "contact-cell";
            var contactName = document.createElement("strong");
            contactName.textContent = contactNumber;
            var contactEmail = document.createElement("span");
            contactEmail.textContent = email;
            contactCell.append(contactName, contactEmail);


            var statusCell =
                document.createElement("td");
            var statusBadge =
                document.createElement("span");
            var status = supplier[6] || "Active";
            statusBadge.className =
                "status-badge " +
                (status === "Active" ? "is-active" : "is-inactive");
            statusBadge.textContent = status;
            statusCell.appendChild(statusBadge);


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

            viewButton.textContent =
                "View";

            viewButton.onclick =
                createViewHandler(index);



            var updateButton =
                document.createElement("button");

            updateButton.className =
                "action-btn update";

            updateButton.textContent =
                "Update";

            updateButton.onclick = function (event) {
                event.stopPropagation();
                openUpdateModal(index);
            };



            var archiveButton =
                document.createElement("button");

            archiveButton.className =
                "action-btn archive";

            archiveButton.textContent =
                "Archive";

            archiveButton.onclick = createArchiveSupplierFunction(index);


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


            row.appendChild(idCell);

            row.appendChild(nameCell);

            row.appendChild(contactCell);

            row.appendChild(statusCell);

            row.appendChild(actionCell);


            tableBody.appendChild(row);


            displayedCount++;

        }


        index++;

    }


    if (displayedCount === 0) {

        emptyMessage.style.display =
            "block";

    } else {

        emptyMessage.style.display =
            "none";

    }


    updateSummary();

}



function createViewHandler(index) {

    return function() {

        viewSupplier(index);

    };

}


function createUpdateHandler(index) {

    return function() {

        openUpdateModal(index);

    };

}


function createDeleteHandler(index) {

    return function() {

        openDeleteModal(index);

    };

}



function viewSupplier(index) {

    if (
        index < 0 ||
        index >= suppliers.length ||
        suppliers[index] == null
    ) {

        reportError("This supplier record is no longer available.");

        return;
    }


    clearReportedError();

    selectedIndex =
        index;

    viewingSupplierIndex =
        index;

    var supplier =
        suppliers[index];

    document.getElementById(
        "detailSupplierId"
    ).textContent =
        supplier[0];


    document.getElementById(
        "detailSupplierName"
    ).textContent =
        supplier[1];


    document.getElementById(
        "detailContactPerson"
    ).textContent =
        supplier[8] || "—";


    document.getElementById(
        "detailEmail"
    ).textContent =
        supplier[4] || "—";


    document.getElementById(
        "detailPhone"
    ).textContent =
        supplier[2] || "—";


    document.getElementById(
        "detailTaxId"
    ).textContent =
        supplier[7] || "—";

    document.getElementById(
        "detailAddress"
    ).textContent =
        supplier[3] || "—";

    var status = supplier[6] || "Active";
    var statusBadge = document.getElementById("detailSupplierStatus");
    statusBadge.textContent = status;
    statusBadge.className =
        "status-badge " +
        (status === "Active" ? "is-active" : "is-inactive");

    var materialsContainer = document.getElementById("detailMaterials");
    var materialTags = String(supplier[5] || "")
        .split(",")
        .map(function (material) {
            return material.trim();
        })
        .filter(Boolean)
        .map(function (material) {
            var tag = document.createElement("span");
            tag.className = "material-tag";
            tag.textContent = material;
            return tag;
        });
    materialsContainer.replaceChildren.apply(
        materialsContainer,
        materialTags
    );

    document.getElementById("directoryView").hidden = true;
    document.getElementById("supplierDetailsView").hidden = false;

}



function openUpdateModal(index) {

    if (
        index < 0 ||
        index >= suppliers.length ||
        suppliers[index] == null
    ) {

        reportError("This supplier record is no longer available.");

        return;
    }


    clearReportedError();

    selectedIndex =
        index;


    var supplier =
        suppliers[index];


    document.getElementById(
        "updateSupplierId"
    ).value =
        supplier[0];


    document.getElementById(
        "updateSupplierName"
    ).value =
        supplier[1];


    document.getElementById(
        "updateContactNumber"
    ).value =
        supplier[2];


    document.getElementById(
        "updateAddress"
    ).value =
        supplier[3];


    document.getElementById(
        "updateEmail"
    ).value =
        supplier[4];


    document.getElementById(
        "updateMaterials"
    ).value =
        supplier[5];

    document.getElementById(
        "updateTaxId"
    ).value =
        supplier[7] || "";

    document.getElementById(
        "updateContactPerson"
    ).value =
        supplier[8] || "";

    document.getElementById(
        "updateStatus"
    ).value =
        supplier[6] || "Active";


    document.getElementById(
        "updateMessage"
    ).textContent = "";


    document.getElementById(
        "updateMessage"
    ).className =
        "form-message";


    document.getElementById(
        "updateModal"
    ).classList.add("show");

}


function saveSupplierUpdate() {

    if (
        selectedIndex < 0 ||
        selectedIndex >= suppliers.length ||
        suppliers[selectedIndex] == null
    ) {

        reportError("Select an available supplier before saving.");

        return;

    }


    clearReportedError();


    var supplierName =
        document.getElementById(
            "updateSupplierName"
        ).value;

    var contactNumber =
        document.getElementById(
            "updateContactNumber"
        ).value;

    var address =
        document.getElementById(
            "updateAddress"
        ).value;

    var email =
        document.getElementById(
            "updateEmail"
        ).value;

    var materials =
        document.getElementById(
            "updateMaterials"
        ).value;

    var status =
        document.getElementById(
            "updateStatus"
        ).value;

    var taxId =
        document.getElementById(
            "updateTaxId"
        ).value;

    var contactPerson =
        document.getElementById(
            "updateContactPerson"
        ).value;


    var message =
        document.getElementById(
            "updateMessage"
        );


    if (supplierName === "") {

        message.textContent =
            "Supplier name is required.";

        message.className =
            "form-message error";

        return;

    }


    if (contactNumber === "") {

        message.textContent =
            "Contact number is required.";

        message.className =
            "form-message error";

        return;

    }


    if (containsOnlyDigits(contactNumber) === false) {

        message.textContent =
            "Contact number must contain digits only, with no spaces.";

        message.className =
            "form-message error";

        return;

    }


    if (contactNumber.length !== 11) {

        message.textContent =
            "Contact number must be exactly 11 digits.";

        message.className =
            "form-message error";

        return;

    }


    if (address === "") {

        message.textContent =
            "Address is required.";

        message.className =
            "form-message error";

        return;

    }


    if (email === "") {

        message.textContent =
            "Email is required.";

        message.className =
            "form-message error";

        return;

    }


    if (materials === "") {

        message.textContent =
            "Materials supplied is required.";

        message.className =
            "form-message error";

        return;

    }


    var previousSupplier =
        suppliers[selectedIndex].slice();

    suppliers[selectedIndex][1] =
        supplierName;

    suppliers[selectedIndex][2] =
        contactNumber;

    suppliers[selectedIndex][3] =
        address;

    suppliers[selectedIndex][4] =
        email;

    suppliers[selectedIndex][5] =
        materials;

    suppliers[selectedIndex][6] =
        status;

    suppliers[selectedIndex][7] =
        taxId;

    suppliers[selectedIndex][8] =
        contactPerson;

    if (!saveSupplierDirectory()) {
        suppliers[selectedIndex] = previousSupplier;
        return;
    }

    viewSupplier(selectedIndex);


    message.textContent =
        "Supplier record updated successfully.";

    message.className =
        "form-message success";


    renderSuppliers(
        document.getElementById(
            "searchSupplier"
        ).value
    );


    setTimeout(
        function() {

            closeUpdateModal();

        },
        500
    );

}



function openDeleteModal(index) {

    if (
        index < 0 ||
        index >= suppliers.length ||
        suppliers[index] == null
    ) {

        reportError("This supplier record is no longer available.");

        return;

    }


    clearReportedError();


    deletingIndex =
        index;


    document.getElementById(
        "deleteModal"
    ).classList.add("show");

}


function createArchiveSupplierFunction(index) {
    return function (event) {
        event.stopPropagation();
        openDeleteModal(index);
    };
}


function confirmDeleteSupplier() {

    if (
        deletingIndex < 0 ||
        deletingIndex >= suppliers.length ||
        suppliers[deletingIndex] == null
    ) {

        reportError("Select an available supplier before archiving.");

        return;

    }


    clearReportedError();
    var supplier = suppliers[deletingIndex];
    window.systemArchive.archive(
        "suppliers",
        supplier[0],
        supplier[1],
        supplier[2] + " · " + supplier[4],
        supplier
    );

    if (viewingSupplierIndex === deletingIndex) {
        viewingSupplierIndex = -1;
        document.getElementById("supplierDetailsView").hidden = true;
        document.getElementById("directoryView").hidden = false;
    }


    deletingIndex = -1;


    closeDeleteModal();


    renderSuppliers(
        document.getElementById(
            "searchSupplier"
        ).value
    );
    window.dispatchEvent(new CustomEvent("systemArchiveChanged"));
}



function updateSummary() {

    var total =
        suppliers.length;

    var activeCount = 0;

    var inactiveCount = 0;

    var index = 0;


    while (
        index <
        suppliers.length
    ) {

        if ((suppliers[index][6] || "Active") === "Active") {
            activeCount++;
        } else {
            inactiveCount++;
        }

        index++;

    }


    document.getElementById(
        "totalSuppliers"
    ).textContent =
        total;


    document.getElementById(
        "activeSuppliers"
    ).textContent =
        activeCount;

    document.getElementById(
        "inactiveSuppliers"
    ).textContent =
        inactiveCount;

}



function closeCreateModal() {

    document.getElementById(
        "createModal"
    ).classList.remove("show");

}



function closeViewModal() {

    document.getElementById(
        "viewModal"
    ).classList.remove("show");

    selectedIndex = -1;

}



function closeUpdateModal() {

    document.getElementById(
        "updateModal"
    ).classList.remove("show");

    selectedIndex = -1;

}



function closeDeleteModal() {

    document.getElementById(
        "deleteModal"
    ).classList.remove("show");

    deletingIndex = -1;

}



document.getElementById(
    "openCreateButton"
).onclick =
    function() {

        openCreateModal();

    };

document.getElementById("backToDirectory").onclick = function () {
    document.getElementById("supplierDetailsView").hidden = true;
    document.getElementById("directoryView").hidden = false;
    viewingSupplierIndex = -1;
};

document.getElementById("editDetailSupplier").onclick = function () {
    openUpdateModal(viewingSupplierIndex);
};

document.getElementById("deleteDetailSupplier").onclick = function () {
    openDeleteModal(viewingSupplierIndex);
};


document.getElementById(
    "closeCreateModal"
).onclick =
    function() {

        closeCreateModal();

    };


document.getElementById(
    "cancelCreateButton"
).onclick =
    function() {

        closeCreateModal();

    };


document.getElementById(
    "saveCreateButton"
).onclick =
    function() {

        saveNewSupplier();

    };



document.getElementById(
    "searchSupplier"
).oninput =
    function() {

        searchSuppliers();

    };


document.getElementById(
    "createContactNumber"
).oninput =
    function() {

        filterContactNumber(this);

    };


document.getElementById(
    "updateContactNumber"
).oninput =
    function() {

        filterContactNumber(this);

    };



document.getElementById(
    "closeViewModal"
).onclick =
    function() {

        closeViewModal();

    };


document.getElementById(
    "closeViewButton"
).onclick =
    function() {

        closeViewModal();

    };



document.getElementById(
    "closeUpdateModal"
).onclick =
    function() {

        closeUpdateModal();

    };


document.getElementById(
    "cancelUpdateButton"
).onclick =
    function() {

        closeUpdateModal();

    };


document.getElementById(
    "saveUpdateButton"
).onclick =
    function() {

        saveSupplierUpdate();

    };



document.getElementById(
    "cancelDeleteButton"
).onclick =
    function() {

        closeDeleteModal();

    };


document.getElementById(
    "confirmDeleteButton"
).onclick =
    function() {

        confirmDeleteSupplier();

    };



document.getElementById(
    "createModal"
).onclick =
    function(event) {

        if (event.target === this) {

            closeCreateModal();

        }

    };


document.getElementById(
    "viewModal"
).onclick =
    function(event) {

        if (event.target === this) {

            closeViewModal();

        }

    };


document.getElementById(
    "updateModal"
).onclick =
    function(event) {

        if (event.target === this) {

            closeUpdateModal();

        }

    };


document.getElementById(
    "deleteModal"
).onclick =
    function(event) {

        if (event.target === this) {

            closeDeleteModal();

        }

    };



function restoreSystemArchivedSuppliers() {
    var restoredSuppliers =
        window.systemArchive.getRestored("suppliers");
    var restoredIndex;
    var supplierIndex;
    var restoredSupplier;
    var supplierExists;

    for (
        restoredIndex = 0;
        restoredIndex < restoredSuppliers.length;
        restoredIndex = restoredIndex + 1
    ) {
        restoredSupplier = restoredSuppliers[restoredIndex];
        if (!Array.isArray(restoredSupplier) || restoredSupplier.length === 0) {
            throw new Error("A restored supplier record is invalid.");
        }

        supplierExists = false;
        for (
            supplierIndex = 0;
            supplierIndex < suppliers.length;
            supplierIndex = supplierIndex + 1
        ) {
            if (String(suppliers[supplierIndex][0]) === String(restoredSupplier[0])) {
                supplierExists = true;
                break;
            }
        }

        if (!supplierExists) {
            suppliers = window.arrayWithAppended(suppliers, restoredSupplier);
        }
    }
}

try {
    loadSupplierDirectory();
    restoreSystemArchivedSuppliers();
    saveSupplierDirectory();
} catch (error) {
    reportError(
        error instanceof Error
            ? error.message
            : "The supplier directory could not be loaded."
    );
}
renderSuppliers("");

window.addEventListener("systemArchiveChanged", function () {
    restoreSystemArchivedSuppliers();
    saveSupplierDirectory();
    renderSuppliers(
        document.getElementById("searchSupplier").value
    );
});

window.addEventListener("storage", function (event) {
    if (event.key === supplierDirectoryStorageKey) {
        try {
            loadSupplierDirectory();
            restoreSystemArchivedSuppliers();
            renderSuppliers(document.getElementById("searchSupplier").value);
        } catch (error) {
            reportError(
                error instanceof Error
                    ? error.message
                    : "The supplier directory could not be loaded."
            );
        }
    }
    if (event.key === "jorjetteangel-system-archive") {
        restoreSystemArchivedSuppliers();
        saveSupplierDirectory();
        renderSuppliers(document.getElementById("searchSupplier").value);
    }
});