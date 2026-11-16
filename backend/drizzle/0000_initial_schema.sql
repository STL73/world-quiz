CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "scores" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"star_tokens" integer DEFAULT 10 NOT NULL,
	"saved_question_id" integer,
	CONSTRAINT "scores_star_tokens_not_negative" CHECK ("scores"."star_tokens" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"country_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "countries_country_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	CONSTRAINT "countries_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"question_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "questions_question_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_id" integer NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"cloudinary_id" varchar(255) NOT NULL,
	"question" varchar(150) NOT NULL,
	"hint" varchar(150) NOT NULL,
	"answer1" varchar(100) NOT NULL,
	"answer2" varchar(100) NOT NULL,
	"answer3" varchar(100) NOT NULL,
	"correct_answer" smallint NOT NULL,
	CONSTRAINT "questions_correct_answer_range" CHECK ("questions"."correct_answer" BETWEEN 1 AND 3)
);
--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_saved_question_id_questions_question_id_fk" FOREIGN KEY ("saved_question_id") REFERENCES "public"."questions"("question_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_country_id_countries_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("country_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_country_id_idx" ON "questions" USING btree ("country_id");