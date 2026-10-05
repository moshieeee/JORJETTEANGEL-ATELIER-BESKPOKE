# JORJETTEANGEL ATELIER
## System Overview and User Instructions

**Course:** Data Structures and Algorithms  
**Year Level:** 2nd Year  
**Term:** 1st Term  
**Project:** Final Project  
**Program:** Bachelor of Science in Information Technology  
**University:** National University  

### Developers

- Axel John Lizardo
- Juno Jonas Mendoza
- Gabriel Jay De Guzman
- Eudge Justine Ubaldo
- Ross Jayden Valenzuela

---

## 1. System Overview

**JorjetteAngel Atelier** is a browser-based e-commerce and business management system designed for a bespoke tailoring and ready-to-wear garment business.

The system consists of three main areas:

### Storefront
The customer-facing area where users can:
- Browse the available garment collection
- View product details and sizing information
- Add products to the shopping bag
- Create or sign in to a customer account
- Manage shopping bag items
- Enter delivery information
- Proceed through checkout
- Review order history

### Backend Portal
The employee-facing area where authorized users can:
- Access the dashboard
- Manage products and product categories
- Manage customer orders
- Monitor business operations
- Access modules based on their assigned role

### Business Modules
The system provides supporting workflows for:
- Production Management
- Finished Goods Inventory
- Fabrics and BOM Management
- Supplier Management
- Purchasing and Restocking
- Delivery and Order Release
- Order Management
- Sales and Payment Management
- Trends and Analytics
- User and Account Management
- Archive
- Audit Trail
- System Settings

The main application entry point is **`index.html`**, located in the project root.

---

# 2. Project Folder Structure

```text
JorjetteAngel-Atelier/
│
├── index.html
│
├── Front/
│   ├── frontend-*.html
│   ├── frontend-*.css
│   └── frontend-*.js
│
├── Backend/
│   ├── backend-*.html
│   ├── backend-*.css
│   └── backend-*.js
│
├── modules/
│   ├── modules-*.html
│   ├── modules-*.css
│   └── modules-*.js
│
├── Shared/
│   └── Shared JavaScript files
│
└── UI/
    └── Images/
```

### `index.html`
The main entry point of the application. It provides access to the Storefront and Admin areas.

### `Front/`
Contains the customer-facing storefront pages, stylesheets, and JavaScript files.

### `Backend/`
Contains the employee portal, dashboard, product administration, authentication, and other administrative pages.

### `modules/`
Contains the different business management modules used by the system.

### `Shared/`
Contains JavaScript utilities and functions shared between different parts of the application.

### `UI/Images/`
Contains image assets used throughout the system interface.

---

# 3. How to Start the Application

1. Open the project folder using **Visual Studio Code** or another code editor.
2. Run the project using a local web server.
3. Open the project's root `index.html` through the local web server.
4. Use the navigation options to access:
   - **Storefront** — Customer-facing system
   - **Admin** — Employee and business management system

> **Important:** It is recommended to run the project through `localhost` or HTTPS instead of opening `index.html` directly using a `file://` address. Some browser security features may not work correctly when the application is opened directly from the filesystem.

The storefront uses externally hosted fonts and scripts, so an internet connection may be required for some resources. Employee email verification also depends on the configured email verification service.

---

# 4. Customer Storefront Instructions

## 4.1 Accessing the Storefront

1. Open `index.html`.
2. Select **Storefront**.
3. Browse the landing page and available product collection.

## 4.2 Browsing Products

1. Browse the available collections.
2. Use the search and filtering options when available.
3. Select a product to view its details.
4. Review the available sizes and product information.
5. For applicable bespoke products, enter the required custom measurements.

## 4.3 Adding Products to the Shopping Bag

1. Select the desired product.
2. Select the appropriate size or required measurements.
3. Specify the quantity.
4. Select **Add to Bag**.
5. Open the shopping bag to review the selected items.

Customers can change quantities or remove items from the shopping bag before checkout.

## 4.4 Customer Account

Customers may:
- Create an account
- Sign in to an existing account
- Manage their account information
- Review previous orders

The required account information must be provided before proceeding with certain checkout functions.

## 4.5 Checkout

1. Open the shopping bag.
2. Review the selected products and quantities.
3. Proceed to checkout.
4. Enter the required delivery information.
5. Review the order summary.
6. Confirm the order information.
7. Submit the order.

> **Note:** Checkout and inventory behavior depend on the product and catalog data available in the current browser session.

---

# 5. Employee Portal Instructions

## 5.1 Accessing the Admin Portal

1. Open `index.html`.
2. Select **Admin**.
3. Sign in using an existing employee account.

If an administrator account does not exist in the current browser session, complete the first-time administrator setup.

## 5.2 Administrator Setup

During the initial setup:

1. Enter a valid email address.
2. Create a password with at least eight characters.
3. Confirm the password.
4. Accept the displayed Philippine Data Privacy Act notice.
5. Complete the email verification process.

The verification code will be sent to the registered email address.

> **Note:** Verification codes expire after 15 minutes.

## 5.3 Dashboard

After successfully signing in, employees can access the dashboard.

The dashboard provides an overview of available business information and serves as the main navigation point for the backend system.

## 5.4 Product Management

Authorized employees can use **Product Management** to:
- View products
- Add products
- Update product information
- Manage product details
- Maintain product records

## 5.5 Product Category

The **Product Category** section allows authorized employees to organize products according to their corresponding categories.

## 5.6 Business Modules

Depending on the employee's assigned role, users may access:
- Production Management
- Finished Goods Inventory
- Fabrics and BOM Management
- Supplier Management
- Purchasing and Restocking
- Delivery and Order Release
- Order Management
- Sales and Payment Management
- Trends and Analytics
- User and Account Management
- Archive
- Audit Trail
- Settings

## 5.7 Logging Out

Employees should select **Log Out** after completing their session.

---

# 6. Current System Modules

| Main Module | Submodule / Function |
|---|---|
| **Dashboard** | Backend Dashboard |
| **Product** | Product Management |
| | Product Category |
| **Production** | Production Management |
| **Supply Chain & Inventory** | Finished Goods Inventory |
| | Fabrics and BOM Management |
| | Supplier Directory / Supplier Management |
| | Purchasing and Restocking |
| | Delivery & Order Release |
| **Sales & Finance** | Order Management |
| | Sales & Payment Management |
| **Reports and Analytics** | Trends & Analytics |
| **System & Security** | Archived Audit Trail |
| | User and Accounts |
| | Settings |

---

# 7. System Limitations

The current version of JorjetteAngel Atelier is a **functional prototype** intended for system demonstration and academic purposes.

The following limitations currently apply:

### Data Storage
Application data, accounts, catalog records, orders, and session information are currently handled through an in-memory browser store.

Data may be lost when:
- The page is refreshed
- The browser tab is closed
- The browser session ends
- The application is restarted

### Client-Side Processing
Authentication, role checking, inventory rules, and record management are currently handled through client-side code.

These mechanisms should not be considered a replacement for secure server-side authentication and authorization.

### Sensitive Information
Do not enter real:
- Customer information
- Employee information
- Payment information
- Passwords used on other services
- Confidential business information

### Database
The current version is not connected to a persistent production database.

Therefore, the system should not be relied upon for:
- Permanent business records
- Actual stock counts
- Real order fulfillment
- Financial records
- Long-term customer information

### External Services
Some resources depend on external services, including:
- Email verification
- Hosted fonts
- External scripts
- Other web-based resources

An active internet connection may therefore be required for certain features.

---

# 8. Requirements for Future Production Deployment

Before the system can be deployed for actual business operations, the following improvements should be implemented:

- Secure backend server
- REST API or equivalent backend service
- Persistent database
- Server-side authentication
- Server-side authorization
- Secure role-based access control
- Persistent and secure user sessions
- Server-side input validation
- Production payment gateway
- Secure email verification service
- Database backup and recovery
- Data encryption where appropriate
- Privacy and security review
- Proper error handling and logging

---

# 9. Troubleshooting

## Blank or Incomplete Page

If the application does not load correctly:

1. Confirm that the project is running through a local web server.
2. Make sure the application is opened from the root `index.html`.
3. Check the browser developer console.
4. Look for missing files or JavaScript errors.
5. Confirm that the project folder structure has not been changed.

## Admin Verification Email Does Not Arrive

Try the following:

1. Confirm that the entered email address is correct.
2. Check the inbox.
3. Check the spam or junk folder.
4. Confirm that the device has an active internet connection.
5. Confirm that the configured email service is active.
6. Request a new verification code if the previous code has expired.

## Products, Orders, or Accounts Are Missing

The current prototype uses an in-memory data store.

Data may disappear after:
- Refreshing the page
- Closing the browser tab
- Ending the browser session

The current version does not provide permanent database storage.

## Employee Cannot Access a Module

Module access depends on the employee's assigned role.

If an employee cannot access a module:

1. Confirm the employee's assigned role.
2. Confirm that the role has permission to access the module.
3. Check the module routing configuration.
4. Verify that the required module files are available.

---

# 10. Suggested System Demonstration Flow

For a project presentation or system demonstration, the following sequence is recommended:

### Part 1 — Storefront

1. Open `index.html`.
2. Select **Storefront**.
3. Show the landing page.
4. Browse the product collection.
5. Open a product.
6. Demonstrate product details and sizing.
7. Add a product to the shopping bag.
8. Demonstrate the customer account.
9. Demonstrate the checkout process using test data.

### Part 2 — Admin Portal

10. Return to the main navigation.
11. Select **Admin**.
12. Demonstrate the administrator setup or employee sign-in.
13. Show the backend dashboard.
14. Demonstrate Product Management.
15. Demonstrate Product Category Management.

### Part 3 — Business Modules

16. Demonstrate Production Management.
17. Demonstrate Finished Goods Inventory.
18. Demonstrate Fabrics and BOM Management.
19. Demonstrate Supplier Management.
20. Demonstrate Purchasing and Restocking.
21. Demonstrate Delivery and Order Release.
22. Demonstrate Order Management.
23. Demonstrate Sales and Payment Management.
24. Demonstrate Trends and Analytics.
25. Demonstrate User and Account Management.
26. Demonstrate Archive and Audit Trail.
27. Demonstrate Settings.

### Part 4 — System Explanation

28. Explain how the system addresses the business's manual processes.
29. Explain how the system organizes products, inventory, production, suppliers, orders, and other business records.
30. Explain the current limitations of the prototype.
31. Log out of the employee account.

---

# 11. Project Purpose

JorjetteAngel Atelier is designed to provide a centralized digital platform for managing the business's storefront and internal operations.

The system aims to reduce the inefficiencies associated with manual record keeping by organizing product information, inventory, production activities, supplier information, purchasing, orders, payments, and other business processes within a single platform.

By combining a customer-facing storefront with an employee-oriented management system, the project provides a unified environment for handling both customer transactions and internal business operations.

---

# 12. Disclaimer

**JorjetteAngel Atelier is currently a functional prototype developed for academic and demonstration purposes.**

The system is not intended for actual commercial deployment in its current state. Persistent storage, production-level security, server-side authentication, payment processing, and other infrastructure required for a production system must be implemented before the application is used for real business operations.
