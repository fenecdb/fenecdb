//! # fennec-wire
//!
//! The client side of PostgreSQL's v3 wire protocol: the framing
//! ([`proto`]) and a client ([`client`]) for a real PostgreSQL server,
//! which `fennec import` reads a table through and `--follow` a logical
//! replication slot.
//!
//! A crate of its own so that the importer, which reads from PostgreSQL
//! through the client, sits below the server, which runs the importer's
//! `--follow` in its own process (`fennec-server --follow`).

pub mod client;
pub mod proto;

/// The hashing SCRAM's client half uses: fennec-http's, which checks JWTs
/// with it too.
pub use fennec_http::crypto;
