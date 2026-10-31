// Go with the fennecdb SDK. Run by ../run-tests.sh.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"

	fennecdb "github.com/fennec-db/fennecdb/integrations/go"
)

type Doc struct {
	Title string `json:"title"`
	Year  int    `json:"year"`
}

type Hit struct {
	Title string  `json:"title"`
	Score float32 `json:"_score"`
}

func main() {
	ctx := context.Background()
	db := fennecdb.New(env("FENNEC_URL", "http://127.0.0.1:8080"), fennecdb.WithToken(os.Getenv("FENNEC_TOKEN")))

	must(db.Exec(ctx, "create collection if not exists docs (title text @text, year int @sorted)"))
	must(db.Exec(ctx, "put docs {title: $1, year: $2}", "Dunes", 2021))
	must(db.Exec(ctx, "put docs {title: $1, year: $2}", "Night at the oasis", 2024))

	rows, err := fennecdb.QueryAs[Doc](ctx, db, "get docs select title, year where year >= $1 order year desc limit $2", 2020, 5)
	if err != nil {
		fail("%v", err)
	}
	if !reflect.DeepEqual(rows, []Doc{{"Night at the oasis", 2024}, {"Dunes", 2021}}) {
		fail("the filtered read answered %v", rows)
	}
	hits, err := fennecdb.QueryAs[Hit](ctx, db, "get docs select title match title $1 fuzzy", "oasys")
	if err != nil || len(hits) != 1 || hits[0].Title != "Night at the oasis" || hits[0].Score <= 0 {
		fail("match answered %v, %v", hits, err)
	}

	// The same through the query builder, which writes that statement itself.
	docs := db.From("docs")
	query := docs.Select("title", "year").Where("year", ">=", 2020).Order("year", "desc").Limit(5)
	if text, _, err := query.ToFennecQL(); err != nil || text != "get docs select title, year where year >= $1 order year desc limit $2" {
		fail("the builder wrote %q, %v", text, err)
	}
	built, err := fennecdb.RowsAs[Doc](ctx, query)
	if err != nil || !reflect.DeepEqual(built, rows) {
		fail("the builder's query answered %v, %v", built, err)
	}
	found, err := fennecdb.RowsAs[Hit](ctx, docs.Select("title").Match("title", "oasys", fennecdb.Fuzzy(2)))
	if err != nil || !reflect.DeepEqual(found, hits) {
		fail("the builder's match answered %v, %v", found, err)
	}
	if n, err := docs.Where("title", "~", "Dunes").Count(ctx); err != nil || n != 1 {
		fail("count answered %d, %v", n, err)
	}

	var e *fennecdb.Error
	if _, err := db.Query(ctx, "get nowhere"); !errors.As(err, &e) || e.Status != 404 {
		fail("a missing collection was answered with %v", err)
	}
	fmt.Println("go (sdk): ok")
}

func env(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func must(_ fennecdb.Result, err error) {
	if err != nil {
		fail("%v", err)
	}
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
