# Authentication
Clients will initiate a *Session* by sending username and password.
All subsequent requests are made using the Session token.


## Passwords
When a new user is created, an initial password is set manually/generated.
It is set to expire with the next login-attempt.

Passwords are hashed and stored with the User document.

See:
- http://codetheory.in/using-the-node-js-bcrypt-module-to-hash-and-safely-store-passwords/
- https://codahale.com/how-to-safely-store-a-password/

## XSS and CSRF Protection
From:
http://www.redotheweb.com/2015/11/09/api-security.html

We need two separate authentication tokens for each request.
One is the *Session Token* it is stored in a cookie with `httponly`
and cannot be accessed by client side JavaScript (thats the XSS part).

We will ask the browser to include this with each request.

Another token is stored in SessionStorage/WebStorage. It can be accessed
by JavaScript and we will add it manually to each request
as a custom HTTP header.

How do we do this?

## Authentication Service
On the server side, provide an endpoint which accepts username and password.
It does not matter whether it's send in the JSON body
or through HTTP Basic Auth.

```
/api/login
```

That endpoint should return the two tokens
- a Set-Cookie header with the Session-token
- a body with the CSRF token.

That endpoint is also responsible for generating the tokens
and for storing both in the database, associated to the user.

Both, session and CSRF token must be **unique** and **random**.


## Authenticating Requests
Each request that needs authentication will do the following steps:
- Check if the session-token is included (if not, fail)
- Check if the CSRF token is included (if not, fail)
- Check if a persisted sessions with two matching tokens exists
- Check if the session is still valid (not expired)
- retrieve the User instance for that session
- handle the authenticated requests and user details


## Ending a Session
An authenticated client can explicitly end its session.
In that case, a DELETE can be send to a session resource (by ID, not token).
or a POST to /logout.

```
POST /api/logout
DELETE /api/session/<id>
```
