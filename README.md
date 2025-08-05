# 🎯 HiveVoice - Self-Hosted Blockchain Invoicing

A modern, self-hosted invoicing system that leverages the Hive blockchain for transparent, zero-fee invoice management and automatic payment detection. Built with Node.js, TypeScript, and Aurelia 2.

## ✨ Key Features

### 🔗 **Blockchain-First Invoicing**
- **Zero Fees**: Leverage Hive's fee-less blockchain for all operations
- **3-Second Settlement**: Near-instant payment detection with Hive's fast block times
- **Primary Storage**: All invoice data encrypted and stored directly on Hive blockchain
- **Bi-directional Encryption**: Both sender and recipient can decrypt invoice data using their memo keys
- **Multi-Currency Support**: Invoice in USD, GBP, EUR, AUD, NZD with automatic HIVE/HBD conversion
- **Unlimited Capacity**: 64KB storage capacity for comprehensive invoices with detailed descriptions

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
- **End-to-End Encryption**: All invoice data encrypted by default using Hive memo encryption
- **No SaaS Lock-in**: Your data lives on the immutable Hive blockchain
- **SQLite Cache**: Lightweight local database for indexing and fast queries
- **Secure Keys**: Uses posting, active, and memo keys (owner key never needed)
- **Privacy First**: Only you and your client can decrypt invoice details

## 🏗️ Architecture

```
📦 HiveVoice (Blockchain-First Architecture)
├─ 🖥️  Backend (Node.js + TypeScript)
│   ├─ Hono API Server
│   ├─ Payment Monitor Service
│   ├─ Hive Blockchain Integration
│   ├─ Memo Encryption/Decryption
│   └─ SQLite Cache (indexing only)
│
├─ 🌐 Frontend (Aurelia 2 + TypeScript)
│   ├─ Invoice Management UI
│   ├─ Rich Invoice Creation
│   ├─ Payment Processing
│   ├─ Dashboard & Analytics
│   └─ HiveKeychain/HiveSigner Integration
│
└─ ⛓️  Hive Blockchain (PRIMARY STORAGE)
    ├─ Encrypted Invoice Posts (64KB capacity)
    ├─ Payment Processing (transfers)
    ├─ Transaction History
    └─ Immutable Data Layer
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20 or later
- **Package Manager**: yarn, npm, or pnpm  
- **Hive Account**: Get one at [signup.hive.io](https://signup.hive.io)
- **Hive Keys**: Posting, active, and memo keys required for full functionality
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
HIVE_MEMO_KEY=5JYourMemoKeyHere... # Required for encrypted invoice storage
HIVE_NODES=https://api.hive.blog,https://api.openhive.network

# Database Configuration
DATABASE_PATH=./invoices.db

# Authentication (for web interface)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

> ⚠️ **Security Note**: 
> - **Posting Key**: Used for storing invoices on-chain (social actions).
> - **Active Key**: Used for payment notifications and transfers (financial actions).
> - **Memo Key**: Used for encrypting/decrypting invoice data. Optional but recommended.
> - Your **owner key** is never needed.

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
4. **Select** currency and add detailed notes and descriptions
5. **Create** - invoice is encrypted and stored as a post on Hive blockchain

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

### Rich Invoice Features

HiveVoice uses Hive posts to store encrypted invoice data with **64KB capacity**, enabling comprehensive invoicing:

**Enhanced Capabilities:**
- **Detailed line items** with full descriptions and specifications
- **Comprehensive notes** and terms & conditions
- **Rich formatting** for professional invoice presentation
- **Multiple pages** of invoice content when needed
- **Future expansion** for attachments and multimedia content

**No Size Constraints:**
- Create invoices with extensive product catalogs
- Include detailed service descriptions and specifications
- Add comprehensive terms, conditions, and payment instructions
- Store complete project documentation within invoices

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `FRONTEND_URL` | No | Frontend URL for CORS |
| `HIVE_USERNAME` | Yes | Your Hive account username |
| `HIVE_POSTING_KEY` | Yes | Posting key for blockchain operations |
| `HIVE_ACTIVE_KEY` | Yes | Active key for transfers and notifications |
| `HIVE_MEMO_KEY` | Yes | Private memo key for invoice encryption (required for blockchain storage) |
| `HIVE_NODES` | No | Comma-separated list of Hive API nodes |
| `DATABASE_PATH` | No | SQLite database file path |
| `ADMIN_USERNAME` | Yes | Web interface admin username |
| `ADMIN_PASSWORD` | Yes | Web interface admin password |

### Generating Hive Keys

To use all features, you will need your **posting**, **active**, and **memo** keys. Here’s how to get them:

#### Method 1: HiveKeychain (Easy)
1. Install the [HiveKeychain browser extension](https://hive-keychain.com/).
2. Import your Hive account using your master password.
3. Go to **Settings > Keys** to view and copy your posting, active, and memo keys.

#### Method 2: cli_wallet (Advanced)
For advanced users, the `cli_wallet` provides a secure, command-line method:

```bash
# Connect to a Hive node
cli_wallet -s wss://api.hive.blog

# Unlock your wallet
unlock "YOUR_WALLET_PASSWORD"

# Derive keys from your master password
get_private_key_from_password your_account_name owner YOUR_MASTER_PASSWORD
get_private_key_from_password your_account_name active YOUR_MASTER_PASSWORD
get_private_key_from_password your_account_name posting YOUR_MASTER_PASSWORD
get_private_key_from_password your_account_name memo YOUR_MASTER_PASSWORD
```


### Blockchain-First Storage

- **Primary Storage**: All invoices are now stored encrypted on the Hive blockchain by default
- **Required Encryption**: The `HIVE_MEMO_KEY` is required for all invoice operations
- **SQLite as Cache**: Local database serves as an index and cache for fast queries
- **Automatic Recovery**: If local cache is lost, invoices can be recovered from the blockchain
- **Bi-directional Access**: Both you and your clients can decrypt invoice data using your respective memo keys

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