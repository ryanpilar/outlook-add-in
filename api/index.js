import dotenv from 'dotenv';

import createHttpApp from './http/app.js';

dotenv.config();

const app = createHttpApp();
const PORT = process.env.PORT || 4000;

app.listen(
    PORT,
    () => console.log(`Server running in ${process.env.NODE_ENV} mode, on port ${PORT}`)
);

export default app;
