import app from './src/app.js';
import { PORT } from './src/config/env.js';

app.listen(PORT, () => {
    console.log(`CodeResMark Server is running on http//:localhost:${PORT}`);
});

// Docker command to start up: docker compose up -d