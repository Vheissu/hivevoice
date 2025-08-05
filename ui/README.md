# hivevoice-ui

This project is bootstrapped by [aurelia/new](https://github.com/aurelia/new).

## TailwindCSS Integration

This project includes TailwindCSS for utility-first CSS styling. TailwindCSS allows you to rapidly build custom user interfaces using low-level utility classes.

### Using TailwindCSS

TailwindCSS is automatically configured and ready to use. You can use any TailwindCSS utility classes in your HTML templates and components.

Example:
```html
<div class="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
  <div class="p-8">
    <h1 class="text-2xl font-bold text-gray-900">Hello TailwindCSS!</h1>
    <p class="text-gray-600">Build amazing UIs with utility classes.</p>
  </div>
</div>
```

### Customizing TailwindCSS

To customize your TailwindCSS configuration, create a `tailwind.config.js` file in your project root:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        'brand-blue': '#1fb6ff',
        'brand-purple': '#7e5bef',
      },
    },
  },
  plugins: [],
}
```

### TailwindCSS Resources

- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [TailwindCSS Cheat Sheet](https://tailwindcomponents.com/cheatsheet/)
- [Tailwind Components](https://tailwindui.com/)

## Start dev web server

    npm start

## Build the app in production mode

    npm run build


## Unit Tests

    npm run test

Run unit tests in watch mode.

    npm run test:watch

