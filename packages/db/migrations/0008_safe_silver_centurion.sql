CREATE TABLE IF NOT EXISTS "token_holders" (
	"token" text NOT NULL,
	"holder" text NOT NULL,
	"balance" numeric(78, 0) NOT NULL,
	CONSTRAINT "token_holders_token_holder_pk" PRIMARY KEY("token","holder")
);
