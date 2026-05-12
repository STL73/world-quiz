-- WorldQuiz seed data — 46 landmark questions
USE wq_db;

-- Schema (mirrors the original `World Qiuz db code.sql`, plus per-row `question`)
DROP TABLE IF EXISTS countries;

CREATE TABLE countries (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    country     VARCHAR(100) NOT NULL,
    img_path    VARCHAR(255) NOT NULL,
    question    VARCHAR(150) NOT NULL,
    hint        VARCHAR(100) NOT NULL,
    answer1     VARCHAR(50)  NOT NULL,
    is_correct1 BOOLEAN      NOT NULL,
    answer2     VARCHAR(50)  NOT NULL,
    is_correct2 BOOLEAN      NOT NULL,
    answer3     VARCHAR(50)  NOT NULL,
    is_correct3 BOOLEAN      NOT NULL
);

INSERT INTO countries (country, img_path, question, hint, answer1, is_correct1, answer2, is_correct2, answer3, is_correct3) VALUES

-- Brazil
('Brazil',        'Images/Brasil/q1-jesus christ statue in rio.jpg',      'Which statue is this?',            'Arms outstretched from a mountain peak, overlooking a famous bay city.',              'Jesus Christ in Bolivia',      0, 'Jesus Christ in Rio',          1, 'Jesus Christ in Portugal',     0),
('Brazil',        'Images/Brasil/q2-rio view from above.jpg',             'Which city is shown?',             'A city famous for Carnival, samba, and a stunning bay ringed by mountains.',           'Rio de Janeiro',               1, 'Sao Paolo',                    0, 'Buenos Aires',                 0),
('Brazil',        'Images/Brasil/q3-caracol falls.jpg',                   'Which waterfall is this?',         'A 130-metre waterfall tucked into the southern highlands of South America.',           'Angel Falls',                  0, 'Iguazu Falls',                 0, 'Caracol Falls',                1),

-- Italy
('Italy',         'Images/Italy/q1-duomo cathedral in milan.jpg',         'Which cathedral is this?',         'A Gothic cathedral with over 3,400 statues that took six centuries to complete.',      'Duomo Cathedral',              1, 'St. Peter''s Cathedral',       0, 'Sagrada Familia',              0),
('Italy',         'Images/Italy/q2-sforza castle in milan.jpg',           'Which castle is this?',            'A 15th-century fortress that once housed Leonardo da Vinci''s workshop.',              'Buckingham Palace',            0, 'Sforza Castle',                1, 'Edinburgh Castle',             0),
('Italy',         'Images/Italy/q3-central station in milan.jpg',         'Which railway station is this?',   'One of Europe''s grandest railway terminals, built in an ornate Art Deco style.',      'Berlin Station',               0, 'Milan Central Station',        1, 'Waterloo station',             0),
('Italy',         'Images/Italy/q4-lake como.jpg',                        'Which lake is this?',              'A deep glacial lake shaped like an upside-down Y, beloved by celebrities for centuries.','Lake Maggiore',               0, 'Lake Como',                    1, 'Lake Garda',                   0),
('Italy',         'Images/Italy/q5-galleria in milan.jpg',                'Which arcade is this?',            'A 19th-century glass-roofed arcade with a famous bull mosaic on its floor.',           'Galleria Vittorio Emanuele II',1, 'Burlington Arcade',            0, 'Galeries Lafayette',           0),
('Italy',         'Images/Italy/q6-venice grand canal.jpg',               'Which waterway is this?',          'A 3.8 km waterway lined with Renaissance palaces in a city built entirely on water.',  'Grand Canal',                  1, 'Canal du Midi',                0, 'Corinth Canal',                0),

-- Switzerland
('Switzerland',   'Images/Switzerland/q1-lake lugano in switzerland.jpg', 'Which lake is this?',              'A glacial lake shared by two Alpine nations, known for its Mediterranean atmosphere.', 'Lake Garda',                   0, 'Lake Lugano',                  1, 'Lake Rila',                    0),
('Switzerland',   'Images/Switzerland/q2-st.moritz in switzerland.jpg',   'Which Alpine resort is this?',     'Host of two Winter Olympics and birthplace of Alpine winter tourism in the 1800s.',    'Valdiser',                     0, 'Trentino',                     0, 'St. Moritz',                   1),
('Switzerland',   'Images/Switzerland/q3-st.moritz in switzerland.jpg',   'Which Alpine resort is this?',     'A glamorous Alpine resort home to the world''s oldest bobsled run.',                   'St. Moritz',                   1, 'Chamonix',                     0, 'Kitzbuhel',                    0),

-- United Kingdom
('United Kingdom','Images/United Kingdom/q1-big ben.jpg',                 'Which clock tower is this?',       'The world''s most famous four-faced chiming clock, beside the Houses of Parliament.',   'Branca Tower',                 0, 'Blackpool Tower',              0, 'Big Ben',                      1),
('United Kingdom','Images/United Kingdom/q2-stonehendge.jpg',             'Which ancient monument is this?',  'A prehistoric stone circle over 4,500 years old whose purpose still puzzles experts.',  'Stonehendge',                  1, 'Easter Islands Giant Stones',  0, 'Stones formation in Chili',    0),
('United Kingdom','Images/United Kingdom/q3-tower bridge.jpg',            'Which bridge is this?',            'A Victorian bascule bridge that splits open to let tall ships pass on the Thames.',     'Golden Gate',                  0, 'Szechenyi Chain Bridge',       0, 'Tower Bridge',                 1),
('United Kingdom','Images/United Kingdom/q4-london eye.jpg',              'Which observation wheel is this?', 'A 135-metre observation wheel offering 360-degree views across a European capital.',    'London Eye',                   1, 'Singapore Flyer',              0, 'High Roller',                  0),

-- France
('France',        'Images/France/q1-Eiffel Tower in Paris.jpg',           'Which tower is this?',             'Built for the 1889 World''s Fair, it was once the tallest structure on Earth.',         'Eiffel Tower',                 1, 'Blackpool Tower',              0, 'Tokyo Tower',                  0),
('France',        'Images/France/q2-arc of triumph.jpg',                  'Which arch is this?',              'Napoleon commissioned this arch to honour soldiers who fought and died for France.',    'Arc de Triomphe',              1, 'Brandenburg Gate',             0, 'Wellington Arch',              0),
('France',        'Images/France/q3-the louvre museum.jpg',               'Which museum is this?',            'The world''s largest art museum, home to over 35,000 works including the Mona Lisa.',   'The Louvre',                   1, 'British Museum',               0, 'Metropolitan Museum',          0),
('France',        'Images/France/q4-le mont-saint-michel.jpg',            'Which island abbey is this?',      'A medieval abbey on a tidal island, cut off from the mainland at high tide.',           'Mont-Saint-Michel',            1, 'St. Michael''s Mount',         0, 'Skellig Michael',              0),

-- UAE
('UAE',           'Images/UAE/q1-dubai gardens.jpg',                      'Which garden is this?',            'A record-breaking outdoor park bursting with over 150 million blooms each season.',     'Dubai Miracle Garden',         1, 'Gardens by the Bay',           0, 'Keukenhof Gardens',            0),
('UAE',           'Images/UAE/q2-burj al khalifa.jpg',                    'Which skyscraper is this?',        'The tallest building ever constructed, piercing the sky at 828 metres.',                'Burj Khalifa',                 1, 'Shanghai Tower',               0, 'One World Trade Center',       0),
('UAE',           'Images/UAE/q3-burj al arab.jpg',                       'Which hotel is this?',             'A sail-shaped hotel on an artificial island, consistently rated the world''s most luxurious.','Burj Al Arab',            1, 'Atlantis The Palm',            0, 'Emirates Palace',              0),
('UAE',           'Images/UAE/q4-dubai skyline.jpg',                      'Which city is shown?',             'A desert city that went from a fishing village to a global metropolis in just 50 years.','Dubai',                       1, 'Abu Dhabi',                    0, 'Doha',                         0),
('UAE',           'Images/UAE/q5-golden dubai frame.jpg',                 'Which landmark is this?',          'A giant picture frame offering panoramic views of both the old and modern city.',        'Dubai Frame',                  1, 'Marina Bay Sands',             0, 'Lotus Temple',                 0),
('UAE',           'Images/UAE/q6-abu dhabi.jpg',                          'Which city is shown?',             'Home to a grand mosque, a Formula 1 circuit, and its very own Louvre outpost.',          'Abu Dhabi',                    1, 'Muscat',                       0, 'Doha',                         0),

-- USA
('USA',           'Images/USA/q1-empire state building.jpg',              'Which skyscraper is this?',        'A 102-storey Art Deco tower that held the world height record for over 40 years.',       'Empire State Building',        1, 'One World Trade Center',       0, 'Chrysler Building',            0),
('USA',           'Images/USA/q2-golden gate bridge.jpg',                 'Which bridge is this?',            'Painted in International Orange, it spans the entrance to a famous Pacific bay.',        'Golden Gate Bridge',           1, 'Bay Bridge',                   0, 'Brooklyn Bridge',              0),
('USA',           'Images/USA/q3-manhattan bridge.jpg',                   'Which bridge is this?',            'A steel suspension bridge over the East River that also carries subway trains.',         'Manhattan Bridge',             1, 'Brooklyn Bridge',              0, 'Williamsburg Bridge',          0),
('USA',           'Images/USA/q4-chicago skyline.jpg',                    'Which city is shown?',             'A lakeside city credited with inventing the skyscraper and the deep-dish pizza.',        'Chicago',                      1, 'Detroit',                      0, 'Milwaukee',                    0),
('USA',           'Images/USA/q5-central park.jpg',                       'Which park is this?',              'An 843-acre urban oasis carved into the heart of the most photographed city skyline.',   'Central Park',                 1, 'Hyde Park',                    0, 'Prospect Park',                0),
('USA',           'Images/USA/q6-trump tower chicago.jpg',                'Which skyscraper is this?',        'A glass skyscraper on the Chicago River bearing the name of a former US president.',     'Trump Tower Chicago',          1, 'Willis Tower',                 0, 'John Hancock Center',          0),
('USA',           'Images/USA/q7-lincoln memorial.jpg',                   'Which memorial is this?',          'Martin Luther King Jr. delivered his "I Have a Dream" speech on its steps in 1963.',     'Lincoln Memorial',             1, 'Jefferson Memorial',           0, 'Vietnam Veterans Memorial',    0),
('USA',           'Images/USA/q8-las vegas.jpg',                          'Which city is shown?',             'A Nevada desert city where neon never switches off and casinos line a famous strip.',    'Las Vegas',                    1, 'Atlantic City',                0, 'Reno',                         0),

-- Canada
('Canada',        'Images/Canada/q1-toronto skyline.jpg',                 'Which tower is this?',             'A skyline defined by a needle-like tower that was once the world''s tallest structure.', 'CN Tower',                     1, 'Empire State Building',        0, 'Space Needle',                 0),

-- Germany
('Germany',       'Images/Germany/q1-cologne cathedral.jpg',              'Which cathedral is this?',         'A Gothic masterpiece that took 632 years to complete and survived WWII bombing around it.','Cologne Cathedral',           1, 'Notre-Dame Cathedral',         0, 'Ulm Minster',                  0),

-- Japan
('Japan',         'Images/Japan/q1-rainbow bridge tokyo.jpg',             'Which bridge is this?',            'A suspension bridge illuminated in colour at night, spanning a bay in Asia''s largest city.','Rainbow Bridge',             1, 'Akashi Kaikyo Bridge',         0, 'Tatara Bridge',                0),

-- China
('China',         'Images/China/q1-shanghai view.jpg',                    'Which city is shown?',             'A riverfront skyline mixing colonial-era buildings with some of the tallest towers on Earth.','Shanghai',                 1, 'Beijing',                      0, 'Shenzhen',                     0),

-- Malaysia
('Malaysia',      'Images/Malaysia/q1-twin towers kuala lumpur.jpg',      'Which towers are these?',          'Twin supertall towers that were the world''s tallest buildings from 1998 to 2004.',      'Petronas Twin Towers',         1, 'Taipei 101',                   0, 'Shanghai Tower',               0),

-- Hungary
('Hungary',       'Images/Hungary/q1-hungarian parliament.jpg',           'Which parliament building is this?','A neo-Gothic parliament on the Danube riverbank, one of Europe''s largest legislatures.', 'Hungarian Parliament',         1, 'Palace of Westminster',        0, 'Bundestag',                    0),
('Hungary',       'Images/Hungary/q2-chain bridge hungary.jpg',           'Which bridge is this?',            'The first permanent bridge to link the hilly west and flat east banks of a twin capital.', 'Szechenyi Chain Bridge',      1, 'Tower Bridge',                 0, 'Charles Bridge',               0),

-- Australia
('Australia',     'Images/Australia/q1-sydney opera house.jpg',           'Which opera house is this?',       'Its shell-like roof sections were inspired, says its architect, by segments of an orange.','Sydney Opera House',          1, 'Royal Opera House',            0, 'Vienna State Opera',           0),
('Australia',     'Images/Australia/q2-sea coast of sydney.jpg',          'Which harbour is this?',           'A harbour where a famous steel arch bridge stands beside one of the world''s great opera houses.','Sydney Harbour',        1, 'San Francisco Bay',            0, 'Table Bay',                    0),

-- Egypt
('Egypt',         'Images/Egypt/q1-the great pyramids.jpg',               'Which ancient monument is this?',  'Ancient royal tombs built 4,500 years ago — the only surviving original Wonder of the World.','Great Pyramids of Giza',    1, 'Pyramids of Teotihuacan',      0, 'Chichen Itza',                 0),
('Egypt',         'Images/Egypt/q2-the great sphinx.jpg',                 'Which ancient monument is this?',  'A limestone colossus with a human face and lion body, gazing east towards the rising sun.','The Great Sphinx',           1, 'Sphinx of Hatshepsut',         0, 'The Androsphinx',              0),

-- India
('India',         'Images/India/q1-taj mahal.jpg',                        'Which mausoleum is this?',         'A Mughal emperor built this white marble mausoleum for his wife who died in childbirth.',  'Taj Mahal',                    1, 'Humayun''s Tomb',              0, 'Bibi Ka Maqbara',              0);
