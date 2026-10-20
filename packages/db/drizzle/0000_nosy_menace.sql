CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"display_name" varchar(100),
	"anonymous_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"streak_current" integer DEFAULT 0,
	"streak_max" integer DEFAULT 0,
	"total_plays" integer DEFAULT 0,
	"total_wins" integer DEFAULT 0,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_anonymous_id_unique" UNIQUE("anonymous_id")
);
--> statement-breakpoint
CREATE TABLE "puzzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_number" integer NOT NULL,
	"publish_date" date NOT NULL,
	"raw_markup" text NOT NULL,
	"compiled_ast" jsonb NOT NULL,
	"client_payload" jsonb NOT NULL,
	"quote_author" varchar(200),
	"quote_work" varchar(300),
	"quote_year" integer,
	"editorial_note" text,
	"difficulty_score" real,
	"max_depth" integer,
	"total_nodes" integer,
	"initial_leaves" integer,
	"status" varchar(20) DEFAULT 'DRAFT',
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"published_at" timestamp with time zone,
	CONSTRAINT "puzzles_edition_number_unique" UNIQUE("edition_number"),
	CONSTRAINT "puzzles_publish_date_unique" UNIQUE("publish_date")
);
--> statement-breakpoint
CREATE TABLE "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"user_id" uuid,
	"anonymous_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"mistakes_count" integer DEFAULT 0,
	"hints_used" jsonb DEFAULT '[]'::jsonb,
	"score" integer,
	"rank_achieved" varchar(50),
	"is_complete" boolean DEFAULT false,
	CONSTRAINT "unique_puzzle_user" UNIQUE("puzzle_id","user_id"),
	CONSTRAINT "unique_puzzle_anonymous" UNIQUE("puzzle_id","anonymous_id")
);
--> statement-breakpoint
CREATE TABLE "node_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"node_id" varchar(20) NOT NULL,
	"total_attempts" integer DEFAULT 0,
	"total_fails" integer DEFAULT 0,
	"hints_requested" integer DEFAULT 0,
	"reveals_used" integer DEFAULT 0,
	"avg_time_to_solve_ms" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_puzzle_node" UNIQUE("puzzle_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "community_puzzles" (
	"id" varchar(8) PRIMARY KEY NOT NULL,
	"creator_alias" varchar(100),
	"raw_markup" text NOT NULL,
	"client_payload" jsonb NOT NULL,
	"plays_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_flagged" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_analytics" ADD CONSTRAINT "node_analytics_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_puzzles_publish_date" ON "puzzles" USING btree ("publish_date");--> statement-breakpoint
CREATE INDEX "idx_play_sessions_puzzle_user" ON "play_sessions" USING btree ("puzzle_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_node_analytics_puzzle" ON "node_analytics" USING btree ("puzzle_id");--> statement-breakpoint
ALTER TABLE "play_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_own_sessions" ON "play_sessions" FOR ALL USING (auth.uid() = user_id);--> statement-breakpoint
CREATE OR REPLACE VIEW "public_puzzles" AS
  SELECT id, edition_number, publish_date, client_payload,
         quote_author, quote_work, quote_year, editorial_note,
         difficulty_score, max_depth, total_nodes, initial_leaves
  FROM puzzles WHERE status = 'PUBLISHED';