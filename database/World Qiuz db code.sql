World Qiuz

--create table--

CREATE TABLE countries (
    id     INT AUTO_INCREMENT PRIMARY KEY,
    country  VARCHAR(100) NOT NULL,
    img_path VARCHAR(255) NOT NULL,
    hint VARCHAR(100) NOT NULL,
    answer1  VARCHAR(50) NOT NULL,
    is_correct1 BOOLEAN NOT NULL,
    answer2  VARCHAR(50) NOT NULL,
    is_correct2 BOOLEAN NOT NULL,
    answer3  VARCHAR(50)  NOT NULL,
    is_correct3 BOOLEAN NOT NULL
)


INSERT INTO countries (country, img_path, hint, answer1, is_correct1, answer2, is_correct2, answer3, is_correct3)
VALUES
("Brasil", "Images/Brasil/q1-jesus christ statue in rio.jpg", " It is located in one of the biggest cities in Brasil.",
"Jesus Christ in Bolivia", false, "Jesus Christ in Rio", true, "Jesus Christ in Portugal", false),

("Brasil", "Images/Brasil/q2-rio view from above.jpg", " It is located in Brasil.",
"Rio de Janeiro", true, "Sao Paolo", false, "Buenos Aires", false),

("Brasil", "Images/Brasil/q3-caracol falls.jpg", " It is located near Porto Alegre Brasil.",
 "Angel Falls", false, "Iguazu Falls", false, "Caracol Falls", true),

("Italy", "Images/Italy/q1-duomo cathedral in milan.jpg", " It is located in Milan.",
 "Duomo Cathedral", true, "St. Peter's Cathedral", false, "Sagrada Familia", false),

("Italy", "Images/Italy/q2-sforza castle in milan.jpg", " It is located in Milan.",
 "Buckingham Palace", false, "Sforza Castle", true, "Edinburgh Castle", false),

("Italy", "Images/Italy/q3-central station in milan.jpg", " It is located in Milan.",
 "Berlin Station", false, "Milan Central Station", true, "Waterloo station", false),

("Switzerland", "Images/Switzerland/q1-lake lugano in switzerland.jpg", " It is located in Switzerland.",
 "Lake Garda", false, "Lake Lugano", true, "Lake Rila", false),

("Switzerland", "Images/Switzerland/q2-st.moritz in switzerland.jpg", " A famous ski resort in the Alps.",
 "Valdiser", false, "Trentino", false, "St. Moritz", true),

("Switzerland", "Images/Switzerland/q3-st.moritz in switzerland.jpg", " A famous ski resort in the Alps.",
 "St. Moritz", true, "Chamonix", false, "Kitzbuhel", false),

("United Kingdom", "Images/United Kingdom/q1-big ben.jpg", " It is located in London.",
 "Branca Tower", false, "Blackpool Tower", false, "Big Ben", true),

("United Kingdom", "Images/United Kingdom/q2-stonehendge.jpg", " It is located near to Salisbury England.",
 "Stonehendge", true, "Easter Islands Giant Stones", false, "Stones formation in Chili", false),

("United Kingdom", "Images/United Kingdom/q3-tower bridge.jpg", " It is located in London.",
 "Golden Gate", false, "Szechenyi Chain Bridge", false, "Tower Bridge", true);



 answers

"Duomo Cathedral", "St. Peter's Cathedral", false, "Sagrada Familia", false
 
"Buckingham Palace", false, "Sforza Castle", true, "Edinburgh Castle", false 

"Berlin Station", false, "Milan Central Station", true, "Waterloo station", false

"Branca Tower", false, "Blackpool Tower", false, "Big Ben", true 

"Stonehendge", true, "Easter Islands Giant Stones", false, "Stones formation in Chili", false 

"Golden Gate", false, "Szechenyi Chain Bridge", false, "Tower Bridge", true

"Lake Garda", false, "Lake Lugano", true, "Lake Rila", false 

"Valdiser", false, "Trentino", false, "St. Moritz", true 

"St. Moritz", true, "Chamonix", false, "Kitzbuhel", false 

"Jesus Christ in Bolivia", false, "Jesus Christ in Rio", true, "Jesus Christ in Portugal", false

"Rio de Janeiro", true, "Sao Paolo", false, "Buenos Aires", false 

"Angel Falls", false, "Iguazu Falls", false, "Caracol Falls", true 












INSERT INTO questions (country_id, image_path, hint)
VALUES
(1, "Images/Italy/q1-duomo cathedral in milan.jpg", " It is located in Milan." ),
(1, "Images/Italy/q2-sforza castle in milan.jpg", " It is located in Milan." ),
(1, "Images/Italy/q3-central station in milan.jpg", " It is located in Milan." ),
(2, "Images/United Kingdom/q1-big ben.jpg", " It is located in London." ),
(2, "Images/United Kingdom/q2-stonehendge.jpg", " It is located near to Salisbury England." ),
(2, "Images/United Kingdom/q3-tower bridge.jpg", " It is located in London." ),
(3, "Images/Switzerland/q1-lake lugano in switzerland.jpg", " It is located in Switzerland." ),
(3, "Images/Switzerland/q2-st.moritz in switzerland.jpg", " A famous ski resort in the Alps." ),
(3, "Images/Switzerland/q3-st.moritz in switzerland.jpg", " A famous ski resort in the Alps." ),
(4, "Images/Brasil/q1-jesus christ statue in rio.jpg", " It is located in one of the biggest cities in Brasil." ),
(4, "Images/Brasil/q2-rio view from above.jpg", " It is located in Brasil." ),
(4, "Images/Brasil/ q3-caracol falls.jpg", " It is located near Porto Alegre Brasil." );




