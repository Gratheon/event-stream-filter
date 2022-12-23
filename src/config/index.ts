import dev from './config.dev';
import prod from './config.prod';

//@ts-ignore
const config =  (process.env.ENV_ID === 'dev' ? dev : prod);

export default config;