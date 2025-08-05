# 🎯 HiveVoice - Self-Hosted Blockchain Invoicing

A modern, self-hosted invoicing system that leverages the Hive blockchain for transparent, zero-fee invoice management and automatic payment detection. Built with Node.js, TypeScript, and Aurelia 2.

## ✨ Key Features

### 🔗 **Blockchain-Powered Invoicing**
- **Zero Fees**: Leverage Hive's fee-less blockchain for all operations
- **3-Second Settlement**: Near-instant payment detection with Hive's fast block times
- **Transparent & Immutable**: All invoices stored as custom_json operations on-chain
- **Multi-Currency Support**: Invoice in USD, GBP, EUR, AUD, NZD with automatic HIVE/HBD conversion

### 💰 **Automatic Payment Processing**
- **Real-Time Monitoring**: Automatically scans Hive blockchain for incoming payments
- **Smart Memo Parsing**: Matches payments to invoices via memo parsing
- **Status Updates**: Automatically updates invoice status (pending → partial → paid)
- **Payment History**: Complete audit trail of all payments with blockchain links

### 🎨 **Modern Web Interface**
- **Beautiful UI**: Clean, responsive design built with Tailwind v4
- **Multiple Payment Methods**: Support for HiveKeychain browser extension and HiveSigner
- **Dashboard Analytics**: Track revenue, pending payments, and invoice statistics
- **Mobile Responsive**: Works perfectly on desktop, tablet, and mobile devices

### 🛡️ **Self-Hosted & Secure**
- **Complete Control**: Host on your VPS, Raspberry Pi, or laptop
- **No SaaS Lock-in**: Your data stays with you
- **SQLite Database**: Lightweight, no additional database server required
- **Secure Keys**: Uses posting and active keys (no owner key needed)

## 🏗️ Architecture

```
📦 HiveVoice
├─ 🖥️  Backend (Node.js + TypeScript)
│   ├─ Hono API Server
│   ├─ Payment Monitor Service
│   ├─ Hive Blockchain Integration
│   └─ SQLite Database
│
├─ 🌐 Frontend (Aurelia 2 + TypeScript)
│   ├─ Invoice Management UI
│   ├─ Payment Processing
│   ├─ Dashboard & Analytics
│   └─ HiveKeychain/HiveSigner Integration
│
└─ ⛓️  Hive Blockchain
    ├─ Invoice Storage (custom_json)
    ├─ Payment Processing (transfers)
    └─ Transaction History
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20 or later
- **Package Manager**: yarn, npm, or pnpm  
- **Hive Account**: Get one at [signup.hive.io](https://signup.hive.io)
- **Hive Keys**: Posting and active keys required (safe for self-hosted apps)
- **SQLite 3**: Usually pre-installed on Linux/macOS

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/Vheissu/hivevoice.git
cd hivevoice

# Install backend dependencies
npm install

# Install frontend dependencies
cd ui
npm install
cd ..
```

### 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3000
FRONTEND_URL=http://localhost:5173

# Hive Blockchain Configuration
HIVE_USERNAME=your-hive-username
HIVE_POSTING_KEY=5JYourPostingKeyHere...
HIVE_ACTIVE_KEY=5JYourActiveKeyHere...
HIVE_NODES=https://api.hive.blog,https://api.openhive.network

# Database Configuration
DATABASE_PATH=./invoices.db

# Authentication (for web interface)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

> ⚠️ **Security Note**: Both posting and active keys are required. The posting key is used for storing invoices on-chain, and the active key is used for payment notifications and transfers. Your owner key is never needed.

### 3. Start Development Servers

```bash
# Terminal 1: Start the backend
npm run dev

# Terminal 2: Start the frontend
cd ui
npm start
```

The application will be available at:
- **Frontend**: http://localhost:9000
- **Backend API**: http://localhost:3000

### 4. Production Deployment

```bash
# Build the application
npm run build
cd ui && npm run build && cd ..

# Start production server
npm start
```

## 📖 User Guide

### Creating Your First Invoice

1. **Login** with your admin credentials
2. **Navigate** to "Create Invoice"
3. **Fill in** client details and invoice items
4. **Select** currency and add any notes
5. **Create** - invoice is automatically stored on Hive blockchain

### Payment Process

1. **Share** the invoice link with your client
2. **Client** can pay using:
   - **HiveKeychain**: Browser extension (recommended)
   - **HiveSigner**: Web-based wallet
3. **System** automatically detects payment within ~10 seconds
4. **Invoice status** updates automatically (pending → partial → paid)

### Payment Detection

Payments are automatically detected when clients send transfers with memos like:
- `"Payment for Invoice INV-1234567890"`
- `"INV-1234567890"`
- `"invoice: INV-1234567890"`

The system monitors the Hive blockchain every 10 seconds and updates invoice status in real-time.

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `FRONTEND_URL` | No | Frontend URL for CORS |
| `HIVE_USERNAME` | Yes | Your Hive account username |
| `HIVE_POSTING_KEY` | Yes | Posting key for blockchain operations |
| `HIVE_ACTIVE_KEY` | Yes | Active key for transfers and notifications |
| `HIVE_NODES` | No | Comma-separated list of Hive API nodes |
| `DATABASE_PATH` | No | SQLite database file path |
| `ADMIN_USERNAME` | Yes | Web interface admin username |
| `ADMIN_PASSWORD` | Yes | Web interface admin password |

### Hive Node Configuration

For better reliability, configure multiple Hive API nodes:

```env
HIVE_NODES=https://api.hive.blog,https://api.openhive.network,https://hived.emre.sh
```

## 💻 Development

### Project Structure

```
hivevoice/
├── src/                    # Backend source code
│   ├── api/               # API routes
│   ├── services/          # Business logic
│   ├── database/          # Database schema
│   ├── middleware/        # Express middleware
│   └── types/            # TypeScript types
├── ui/                    # Frontend source code
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── services/     # Frontend services
│   │   └── types/        # Frontend types
│   └── dist/             # Built frontend files
├── docs/                  # Documentation
└── scripts/              # Build and deployment scripts
```

### Available Scripts

**Backend:**
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm run lint         # Lint TypeScript code
npm test             # Run tests
```

**Frontend:**
```bash
cd ui
npm start            # Start development server
npm run build        # Build for production
npm run lint         # Lint TypeScript and CSS
npm test             # Run Vitest tests
```

### Adding New Features

1. **Backend**: Add routes in `src/api/`, business logic in `src/services/`
2. **Frontend**: Add pages in `ui/src/pages/`, services in `ui/src/services/`
3. **Database**: Update schema in `src/database/schema.ts`
4. **Types**: Add TypeScript interfaces in respective `types/` directories

## 🔌 API Reference

### Invoice Management

- `GET /api/invoices` - List all invoices
- `GET /api/invoices/:id` - Get specific invoice
- `POST /api/invoices` - Create new invoice
- `DELETE /api/invoices/:id` - Delete invoice
- `GET /api/invoices/:id/payments` - Get payment history

### Currency & Conversion

- `GET /api/invoices/currencies` - Get supported currencies and rates
- `POST /api/invoices/convert` - Convert amount to HIVE/HBD

### Dashboard

- `GET /api/dashboard/stats` - Get dashboard statistics

### Authentication

- `POST /api/auth/login` - Login to web interface
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check authentication status

## 🔍 Troubleshooting

### Common Issues

**Backend won't start:**
- Check that your Hive account exists and posting key is correct
- Verify Node.js version is 20 or later
- Ensure SQLite is installed

**Payment detection not working:**
- Verify `HIVE_USERNAME` matches your account exactly
- Check that Hive API nodes are accessible
- Look for payment monitoring logs in console

**Frontend build fails:**
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript compiler errors: `npm run build`

### Logs & Debugging

Enable debug logging:
```bash
DEBUG=hivevoice:* npm run dev
```

Check payment monitor status:
```bash
# Look for these log messages:
✅ Payment monitoring service started
🔍 Starting payment monitoring service...
💰 Payment recorded: 10.000 HIVE from customer123 for invoice INV-123
📄 Invoice INV-123 status updated to: paid
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Hive Blockchain** - For providing a fee-less, fast blockchain platform
- **Aurelia Team** - For the excellent frontend framework
- **Hono** - For the lightweight, fast web framework
- **Community** - For feedback and contributions

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Vheissu/hivevoice/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Vheissu/hivevoice/discussions)

---

**Built with ❤️ for the Hive ecosystem**

Made possible by the amazing Hive blockchain and its zero-fee, 3-second settlement capabilities. Perfect for freelancers, small businesses, and anyone who values financial sovereignty and transparency.