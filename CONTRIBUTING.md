# Contributing to HiveVoice

Thank you for your interest in contributing to HiveVoice! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

If you find a bug or have a feature request:

1. **Search existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear, descriptive title
   - Detailed description of the problem/feature
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Environment details (OS, Node.js version, etc.)

### Submitting Code Changes

1. **Fork the repository**
   ```bash
   git clone https://github.com/Vheissu/hivevoice.git
   cd hivevoice
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

4. **Test your changes**
   ```bash
   # Backend tests
   npm test
   
   # Frontend tests
   cd ui && npm test
   
   # Build check
   npm run build
   cd ui && npm run build
   
   # Lint check
   npm run lint
   cd ui && npm run lint
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new invoice filtering feature"
   ```

6. **Push and create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📋 Development Guidelines

### Code Style

- **TypeScript**: Use strict TypeScript with proper typing
- **ESLint**: Follow the existing ESLint configuration
- **Formatting**: Use consistent indentation (2 spaces)
- **Naming**: Use descriptive variable and function names

### Commit Messages

Follow conventional commit format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add payment status filtering
fix: resolve invoice date parsing issue
docs: update API documentation
```

### Code Organization

**Backend (`src/`):**
- `api/` - API route handlers
- `services/` - Business logic and external service integrations
- `database/` - Database schema and migrations
- `middleware/` - Express middleware
- `types/` - TypeScript type definitions

**Frontend (`ui/src/`):**
- `pages/` - Aurelia page components
- `services/` - Frontend service classes
- `types/` - Frontend TypeScript types

### Testing

- Write unit tests for new functionality
- Test both success and error cases
- Use meaningful test descriptions
- Mock external dependencies appropriately

**Backend Testing:**
```bash
npm test                    # Run all tests
npm test -- --watch        # Run tests in watch mode
```

**Frontend Testing:**
```bash
cd ui
npm test                    # Run Vitest tests
npm test -- --watch        # Run tests in watch mode
```

## 🔧 Development Setup

### Prerequisites

- Node.js 20 or later
- Git
- A Hive account for testing
- SQLite 3

### Initial Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/Vheissu/hivevoice.git
   cd hivevoice
   npm install
   cd ui && npm install && cd ..
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development servers**
   ```bash
   # Terminal 1: Backend
   npm run dev
   
   # Terminal 2: Frontend
   cd ui && npm start
   ```

### Project Architecture

HiveVoice follows a clear separation between backend and frontend:

- **Backend**: Node.js with Hono framework, TypeScript, SQLite
- **Frontend**: Aurelia 2 with TypeScript, Vite, Tailwind CSS
- **Blockchain**: Hive blockchain integration via @hiveio/dhive

## 🚀 Types of Contributions

### 🐛 Bug Fixes
- Fix existing functionality that doesn't work as expected
- Improve error handling
- Performance optimizations

### ✨ New Features
- Payment processing improvements
- UI/UX enhancements
- Additional currency support
- Reporting and analytics
- Integration with other services

### 📚 Documentation
- README improvements
- API documentation
- Code comments
- Tutorial content

### 🧪 Testing
- Unit test coverage
- Integration tests
- End-to-end testing
- Performance testing

### 🎨 Design & UI
- User interface improvements
- Responsive design fixes
- Accessibility enhancements
- Design system consistency

## 🎯 Contribution Ideas

If you're looking for ways to contribute:

- **Payment Detection**: Improve blockchain monitoring efficiency
- **Multi-language Support**: Add internationalization
- **Export Features**: PDF generation, CSV exports
- **Email Integration**: Automated invoice delivery
- **Mobile App**: React Native or Flutter companion app
- **Analytics Dashboard**: Better reporting and insights
- **API Documentation**: OpenAPI/Swagger documentation
- **Docker Support**: Containerization for easy deployment

## 🔍 Code Review Process

1. **Automated Checks**: All PRs must pass:
   - TypeScript compilation
   - ESLint checks
   - Unit tests
   - Build process

2. **Manual Review**: Maintainers will review:
   - Code quality and style
   - Test coverage
   - Documentation updates
   - Breaking changes

3. **Feedback**: Address any requested changes
4. **Merge**: Once approved, changes will be merged

## 📝 Documentation Standards

- **README**: Keep installation and usage instructions current
- **Code Comments**: Document complex business logic
- **API Documentation**: Update API docs for new endpoints
- **CHANGELOG**: Significant changes should be documented

## 🙋‍♀️ Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: Ask questions in PR comments

## 📄 License

By contributing to HiveVoice, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to HiveVoice! Your efforts help make blockchain invoicing accessible to everyone. 🚀