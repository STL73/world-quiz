CREATE TYPE "public"."round_status" AS ENUM('active', 'finished', 'abandoned');--> statement-breakpoint
CREATE TABLE "round_questions" (
	"round_question_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "round_questions_round_question_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"round_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"question_id" integer NOT NULL,
	"answer_order" integer[] NOT NULL,
	"shown_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"chosen_answer" smallint,
	"hint_used" boolean DEFAULT false NOT NULL,
	"correct" boolean,
	"tokens_awarded" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "round_questions_round_position_unique" UNIQUE("round_id","position"),
	CONSTRAINT "round_questions_round_question_unique" UNIQUE("round_id","question_id"),
	CONSTRAINT "round_questions_position_range" CHECK ("round_questions"."position" BETWEEN 1 AND 10),
	CONSTRAINT "round_questions_chosen_answer_range" CHECK ("round_questions"."chosen_answer" BETWEEN 1 AND 3),
	CONSTRAINT "round_questions_tokens_not_negative" CHECK ("round_questions"."tokens_awarded" >= 0),
	CONSTRAINT "round_questions_answer_order_shuffle" CHECK (cardinality("round_questions"."answer_order") = 3 AND "round_questions"."answer_order" @> ARRAY[1, 2, 3]),
	CONSTRAINT "round_questions_answer_complete" CHECK (("round_questions"."answered_at" IS NULL) = ("round_questions"."chosen_answer" IS NULL) AND ("round_questions"."answered_at" IS NULL) = ("round_questions"."correct" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"round_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rounds_round_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"status" "round_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "rounds_finished_at_matches_status" CHECK (("rounds"."status" = 'active') = ("rounds"."finished_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "scores" DROP CONSTRAINT "scores_saved_question_id_questions_question_id_fk";
--> statement-breakpoint
ALTER TABLE "round_questions" ADD CONSTRAINT "round_questions_round_id_rounds_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("round_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_questions" ADD CONSTRAINT "round_questions_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "round_questions_question_id_idx" ON "round_questions" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_one_active_per_user" ON "rounds" USING btree ("user_id") WHERE "rounds"."status" = 'active';--> statement-breakpoint
CREATE INDEX "rounds_user_id_idx" ON "rounds" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "scores" DROP COLUMN "saved_question_id";