# AdonisJS Development Guide

This project uses **AdonisJS 6**. To maintain framework consistency, project stability, and avoid boilerplate errors, strict adherence to the Adonis CLI is required.

## 🚨 THE GOLDEN RULE: CLI OVER MANUAL
**Never create framework-managed files (Controllers, Models, Migrations, etc.) manually.** 

AdonisJS relies on specific naming conventions, folder structures, and registration logic. Using the CLI (`node ace`) ensures that:
1. Files are placed in the correct directory.
2. Boilerplate code is correctly generated.
3. Required imports and class structures are present.
4. The framework's internal registries are updated.

---

## 🛠 Common CLI Commands (Ace)

### Database & Models
- **Create a Migration**: `node ace make:migration <name>`
- **Create a Model**: `node ace make:model <Name>`
- **Run Migrations**: `node ace migration:run`
- **Rollback Migration**: `node ace migration:rollback`

### Application Logic
- **Create a Controller**: `node ace make:controller <Name>`
- **Create a Validator**: `node ace make:validator <Name>`
- **Create a Policy**: `node ace make:policy <Name>`
- **Create a Middleware**: `node ace make:middleware <Name>`

---

## 📝 Hard Rules for Development

### 1. Controllers
- Keep them **thin**. 
- **Forbidden**: Writing complex business logic or raw DB queries inside a controller.
- **Required**: Delegate all logic to a **Service** and use **Transformers** to format the output.

### 2. Services
- Create a service for every distinct business domain (e.g., `app/services/documents/`).
- Services should be stateless and focused on a single responsibility.

### 3. Data Validation
- Every `POST`, `PUT`, or `PATCH` request **must** use a VineJS validator.
- Never manually validate `request.all()` inside the controller.

### 4. Authorization
- Use **Bouncer Policies** for all permission checks.
- Call `bouncer.authorize()` in the controller or use the `can` middleware on the route.

### 5. Inertia Rendering
- Always use `inertia.render('path/to/page', { props })`.
- Ensure the page name matches the file path in `inertia/pages/`.
