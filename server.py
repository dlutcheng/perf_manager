### openssl req -new -x509 -days 365 -nodes -out cert.pem -keyout key.pem -subj "/CN=c14204"

import ssl
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

certfile = os.path.expanduser('~/cert.pem')
keyfile  = os.path.expanduser('~/key.pem')

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile, keyfile)

httpd = HTTPServer(('0.0.0.0', 8082), SimpleHTTPRequestHandler)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print('HTTPS server running on https://c14204:8082')
httpd.serve_forever()