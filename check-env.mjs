console.log('Environment Variables:');
console.log('VITE_FRONTEND_URL:', process.env.VITE_FRONTEND_URL);
console.log('VITE_APP_URL:', process.env.VITE_APP_URL);
console.log('APP_URL:', process.env.APP_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check if we can get the request origin
console.log('\nChecking available env vars:');
Object.keys(process.env).filter(k => k.includes('URL') || k.includes('HOST') || k.includes('DOMAIN')).forEach(key => {
  console.log(key + ':', process.env[key]);
});
