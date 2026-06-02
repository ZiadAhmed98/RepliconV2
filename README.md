# Replicon Dashboard (mds-premium-modern)

A modern, full-stack web application designed for comprehensive project management, employee tracking, timesheet operations, and compliance monitoring.

## 🚀 Features

*   **Dashboard:** High-level overview and interactive metrics powered by ApexCharts.
*   **Employee Management:** Track and manage employee data and activity.
*   **Project Deep Dive:** Detailed analysis and insights into specific projects and metrics.
*   **Smart Initiator:** Intelligent project initiation and setup workflows.
*   **Timesheet Operations:** Comprehensive timesheet management, submission, and tracking.
*   **Compliance:** Built-in compliance monitoring and enforcement tools.

## 🛠 Tech Stack

*   **Frontend:** React 18, React Router v6, Vite
*   **Data Visualization:** ApexCharts & React ApexCharts
*   **Backend:** Node.js, Express
*   **API / HTTP Client:** Axios
*   **Styling:** CSS Modules & Vanilla CSS
*   **Containerization:** Docker, Docker Compose

## 📋 Prerequisites

Ensure you have the following installed:
*   [Node.js](https://nodejs.org/) (LTS recommended)
*   [Docker](https://www.docker.com/) & Docker Compose (optional, for containerized environments)

## 🏃‍♂️ Getting Started

### Local Development Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Frontend Development Server:**
    ```bash
    npm run dev
    ```
    This will start the Vite server with hot-module replacement (HMR).

3.  **Start the Backend Server (if running independently):**
    ```bash
    npm start
    ```

### Docker Setup

You can easily spin up the entire application stack using Docker Compose.

1.  **Build and run the containers:**
    ```bash
    docker-compose up --build
    ```
    This uses the provided `Dockerfile` and `docker-compose.yml` to build and serve the application.

## 📂 Project Structure

```text
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker services configuration
├── server.js              # Express backend server setup
├── vite.config.js         # Vite bundler configuration
└── src/
    ├── api/               # API integration logic (e.g., Replicon API wrapper)
    ├── components/        # Reusable UI components (Navbar, Login, Modals)
    ├── hooks/             # Custom React hooks (e.g., useRepliconData)
    ├── pages/             # Application views (Dashboard, TimesheetOps, etc.)
    └── styles/            # Global CSS styles
```

## 📜 Available Scripts

*   `npm run dev`: Starts the Vite development server.
*   `npm run build`: Compiles and bundles the application for production.
*   `npm run preview`: Previews the built production application locally.
*   `npm start`: Runs the Node.js Express server.
