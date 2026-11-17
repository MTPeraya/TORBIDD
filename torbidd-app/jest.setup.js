import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
if (typeof global.Request === 'undefined' && typeof globalThis.Request !== 'undefined') {
  global.Request = globalThis.Request;
}
if (typeof global.Response === 'undefined' && typeof globalThis.Response !== 'undefined') {
  global.Response = globalThis.Response;
}
if (typeof global.Headers === 'undefined' && typeof globalThis.Headers !== 'undefined') {
  global.Headers = globalThis.Headers;
}
