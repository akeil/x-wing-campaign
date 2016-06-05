# X-Wing Campaign

Campaign tracker for the X-Wing boardgame


## Data Model
The data model consists of the following entities:
- Ship (*static*)
- Upgrade (*static*)
- Mission (*static*)
- User
- Campaign
- Pilot

```
+--------------------------------------+
|                                      |
|      User <----+     +----> Ship     |
|                |     |               |
|                 Pilot                |
|                |  |  |               |
|  Campaign <----+  |  +----> Upgrade  |
|   |               |                  |
|   |               |                  |
|   |               |                  |
|   +-> Mission <---+                  |
|                                      |
+--------------------------------------+
```
