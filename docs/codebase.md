# Codebase Overview

This project is a modern monolith built with **AdonisJS 6**, **Inertia.js**, and **React**. It leverages a service-oriented architecture on the backend and a component-based architecture on the frontend.

## 🏗 Architecture

### Backend (AdonisJS)
The backend follows a layered architecture to ensure separation of concerns:

- **Routes (`start/routes.ts`)**: The entry point for all requests. Defines endpoints and maps them to controllers.
- **Controllers (`app/controllers/`)**: Thin coordinators. They handle HTTP requests, call the appropriate services, and render Inertia pages.
- **Services (`app/services/`)**: The "brain" of the application. All complex business logic, external API calls, and data processing reside here.
- **Models (`app/models/`)**: Lucid ORM models that define the database schema and relationships.
- **Transformers (`app/transformers/`)**: A critical layer that converts database models into clean, frontend-ready JSON objects. This prevents leaking internal DB structure to the client.
- **Validators (`app/validators/`)**: VineJS schemas used to validate incoming request data.
- **Policies (`app/policies/`)**: Bouncer policies used for granular authorization (e.g., "Can this user edit this document?").

### Frontend (React + Inertia)
The frontend is a Single Page Application (SPA) that feels like a multi-page app thanks to Inertia.js.

- **Pages (`inertia/pages/`)**: React components that map 1:1 with backend `inertia.render` calls.
- **Components (`inertia/components/`)**: Reusable UI elements organized by feature.
- **Layouts (`inertia/layouts/`)**: Wrapper components (e.g., `DefaultLayout`) providing a consistent shell across pages.
- **Entry Point (`inertia/app.tsx`)**: Initializes the Inertia app and handles dynamic page resolution.

## 🔄 Data Flow

1. **Request**: Browser $\rightarrow$ `start/routes.ts` $\rightarrow$ Controller.
2. **Logic**: Controller $\rightarrow$ Service $\rightarrow$ Model.
3. **Transformation**: Model $\rightarrow$ Transformer $\rightarrow$ Plain Object.
4. **Response**: Controller $\rightarrow$ `inertia.render('page', { props })` $\rightarrow$ React Page.

## 🛠 Key Technologies
- **AdonisJS 6**: Node.js framework (Backend).
- **Lucid ORM**: Database interaction.
- **Inertia.js**: The glue between Adonis and React.
- **React**: UI Library (Frontend).
- **VineJS**: Data validation.
- **Bouncer**: Authorization.
- **Vite**: Frontend build tool.
