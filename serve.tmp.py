from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        SimpleHTTPRequestHandler.end_headers(self)
    def log_message(self,*a): pass
ThreadingHTTPServer(('127.0.0.1',8099), H).serve_forever()
