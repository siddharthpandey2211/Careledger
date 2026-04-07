# CareLedger - Frontend

This is the frontend for CareLedger, a healthcare management system.

## Setup Instructions

### Running Locally
1. Start the backend server: `node server.js`
2. Visit `http://localhost:3000` in your browser
3. The app will automatically connect to your local backend

### Using the GitHub Pages Version
Since GitHub Pages only hosts static files, you'll need to:
1. Run the backend server locally: `node server.js` (it will run on `http://localhost:3000`)
2. Visit the GitHub Pages URL: https://siddharthpandey2211.github.io/Careledger/
3. In the **Connection** panel, the API Base URL will default to `http://localhost:3000/api`
4. Click **Check Health** to verify the connection

### For Production Deployment
To fully deploy this as a live application:
1. **Deploy the backend** to a cloud platform (Heroku, Railway, Render, etc.)
2. **Update the API Base URL** in the frontend to your backend's production URL
3. The frontend will automatically work with your deployed backend

### Features
- **Patient Portal**: View prescriptions, consultations, and health information
- **Doctor Portal**: Manage patients and prescriptions  
- **Admin Panel**: Administer system settings
- **Authentication**: Secure login with JWT tokens
- **Prescription Management**: Track active medications and allergies

## Technology Stack
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
