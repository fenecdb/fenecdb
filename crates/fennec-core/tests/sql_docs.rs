//! site/content/docs/sql.html: its session, SQL and FennecQL in the page's
//! order, run as `redis_docs.rs` runs a page -- each `-- → x` the answer it
//! checks -- and each line of its tables held to the FennecQL beside it:
//! `<tr data-same>` the two parse to one statement, `<tr data-refused>` the
//! SQL is refused and the FennecQL parses.

use fennec_core::query::Statement;

const PAGE: &str = include_str!("../../../site/content/docs/sql.html");

#[test]
fn the_session_runs_and_answers_what_the_page_says() {
    let (statements, checked) = super::redis_docs::run_blocks(PAGE, &["fennecql", "sql"]);
    assert!(
        statements >= 11 && checked >= 10,
        "{statements} run, {checked} checked"
    );
}

/// Each `<tr data-<kind>>` row's `<code>`s, unescaped, in order.
fn rows(kind: &str) -> Vec<Vec<String>> {
    let open = format!("<tr data-{kind}>");
    let mut out = Vec::new();
    let mut rest = PAGE;
    while let Some(at) = rest.find(&open) {
        rest = &rest[at + open.len()..];
        let row = &rest[..rest.find("</tr>").expect("a row ends")];
        let codes = row
            .split("<code>")
            .skip(1)
            .map(|c| {
                c.split("</code>")
                    .next()
                    .unwrap()
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&quot;", "\"")
                    .replace("&amp;", "&")
            })
            .collect();
        out.push(codes);
    }
    out
}

#[test]
fn each_spelling_is_the_fennecql_beside_it() {
    let same = rows("same");
    assert!(same.len() >= 25, "{} rows", same.len());
    for codes in same {
        let (sql, fennecql) = (&codes[0], &codes[1]);
        let mut a = fennec_ql::parse_one(sql).unwrap_or_else(|e| panic!("{sql}: {e}"));
        // A join read without flat rows carries its names, held to its
        // tables' fields, and whether its list may be probed, which FennecQL
        // has no words for: set aside.
        if let Statement::Select(s) = &mut a {
            if s.flat.as_ref().is_some_and(|f| f.columns.is_empty()) {
                s.flat = None;
            }
        }
        let b = fennec_ql::parse_one(fennecql).unwrap_or_else(|e| panic!("{fennecql}: {e}"));
        assert_eq!(a, b, "{sql}");
    }
}

/// `<tr data-as>`: the SQL is the FennecQL's statement answered as SQL
/// answers it -- a join's `lookup` flat, pgvector's operator held to the
/// index's distance -- which no FennecQL text asks for.
#[test]
fn each_join_is_the_lookup_beside_it_answered_flat() {
    let rows = rows("as");
    assert!(rows.len() >= 4, "{} rows", rows.len());
    for codes in rows {
        let (sql, fennecql) = (&codes[0], &codes[1]);
        let Statement::Select(mut s) =
            fennec_ql::parse_one(sql).unwrap_or_else(|e| panic!("{sql}: {e}"))
        else {
            panic!("{sql}")
        };
        let asked =
            s.flat.take().is_some() || s.near.as_mut().and_then(|n| n.metric.take()).is_some();
        assert!(asked, "{sql}: neither flat nor pgvector's");
        let b = fennec_ql::parse_one(fennecql).unwrap_or_else(|e| panic!("{fennecql}: {e}"));
        assert_eq!(Statement::Select(s), b, "{sql}");
    }
}

#[test]
fn each_refusal_is_refused_and_its_fennecql_is_not() {
    let refused = rows("refused");
    assert!(refused.len() >= 15, "{} rows", refused.len());
    for codes in refused {
        let sql = &codes[0];
        assert!(fennec_ql::parse(sql).is_err(), "{sql} parses");
        // The FennecQL to write, where the cell holds a statement rather
        // than a `/batch`.
        let fennecql = &codes[1];
        if !fennecql.starts_with('/') {
            fennec_ql::parse(fennecql).unwrap_or_else(|e| panic!("{fennecql}: {e}"));
        }
    }
}
