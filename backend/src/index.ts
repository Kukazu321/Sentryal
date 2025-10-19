import app from './app';
import { config } from './config';

const PORT = Number(config.port || 5000);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${PORT}`);
});
