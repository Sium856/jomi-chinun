-- Land Buy Checker: tables and DEMO data for "Land Survey & Plot Information" and "Road & Building Setback Guide"
-- Run:  sqlite3 app.db < land_features_seed.sql
-- All rows are DEMO DATA (illustrative). They are not official land records, not legal advice, not building approval.
-- To use real data later: keep the same tables, load verified rows, and set data_status = 'verified'.

CREATE TABLE IF NOT EXISTS land_plots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  division_en TEXT, division_bn TEXT, district_en TEXT, district_bn TEXT, upazila_en TEXT, upazila_bn TEXT,
  mouza_en TEXT NOT NULL, mouza_bn TEXT NOT NULL,
  survey_type TEXT NOT NULL CHECK (survey_type IN ('CS','SA','RS','BS','OT')),
  khatian_no TEXT NOT NULL, dag_no TEXT NOT NULL,
  area REAL NOT NULL CHECK (area > 0), area_unit TEXT NOT NULL CHECK (area_unit IN ('dec','katha','bigha')),
  map_ref TEXT,                                   -- NULL = no map data
  road_type_en TEXT, road_type_bn TEXT,           -- NULL = no road information
  road_width_ft REAL,                             -- NULL = width not recorded
  road_authority_en TEXT, road_authority_bn TEXT, -- NULL = owner/authority not recorded (never guessed)
  road_info_status TEXT CHECK (road_info_status IN ('demo','unverified','verified')),
  data_status TEXT NOT NULL DEFAULT 'demo' CHECK (data_status IN ('demo','verified')),
  UNIQUE (khatian_no, dag_no)
);
CREATE INDEX IF NOT EXISTS idx_plots_place ON land_plots(division_en, district_en, upazila_en);

CREATE TABLE IF NOT EXISTS setback_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authority_en TEXT NOT NULL, authority_bn TEXT NOT NULL,
  min_width_ft REAL NOT NULL, max_width_ft REAL NOT NULL,   -- min <= width < max
  front_ft REAL NOT NULL, side_ft REAL NOT NULL, rear_ft REAL NOT NULL,
  data_status TEXT NOT NULL DEFAULT 'demo' CHECK (data_status IN ('demo','verified')),
  CHECK (max_width_ft > min_width_ft)
);

DELETE FROM land_plots; DELETE FROM setback_rules;

INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Savar','সাভার','Savar','সাভার','RS','101','12',5.5,'dec','Demo Sheet 12','Union road','ইউনিয়ন সড়ক',20,'Union Parishad','ইউনিয়ন পরিষদ','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Savar','সাভার','Savar','সাভার','BS','102','15',3,'katha',NULL,'Link road','সংযোগ সড়ক',NULL,NULL,NULL,'unverified');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Savar','সাভার','Ashulia','আশুলিয়া','SA','103','20',12,'dec','Demo Sheet 7','Highway service road','হাইওয়ের সার্ভিস রোড',30,'Roads and Highways Dept','সড়ক ও জনপথ অধিদপ্তর','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Savar','সাভার','Ashulia','আশুলিয়া','CS','104','8',2.5,'katha',NULL,'Private lane','ব্যক্তিগত গলি',10,NULL,NULL,'unverified');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Dhamrai','ধামরাই','Dhamrai','ধামরাই','RS','105','30',8,'dec','Demo Sheet 3','Municipal road','পৌর সড়ক',40,'Pourashava','পৌরসভা','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Dhamrai','ধামরাই','Dhamrai','ধামরাই','BS','106','5',4,'katha',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Gazipur','গাজীপুর','Gazipur Sadar','গাজীপুর সদর','Gazipur Sadar','গাজীপুর সদর','RS','107','41',6,'dec','Demo Sheet 21','Municipal road','পৌর সড়ক',24,'Pourashava','পৌরসভা','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Gazipur','গাজীপুর','Gazipur Sadar','গাজীপুর সদর','Gazipur Sadar','গাজীপুর সদর','CS','108','22',10,'dec',NULL,'City road','শহরের সড়ক',18,'City Corporation','সিটি কর্পোরেশন','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Keraniganj','কেরানীগঞ্জ','Keraniganj','কেরানীগঞ্জ','BS','109','9',3,'katha','Demo Sheet 5','Link road','সংযোগ সড়ক',16,'LGED','স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Dhaka','ঢাকা','Keraniganj','কেরানীগঞ্জ','Keraniganj','কেরানীগঞ্জ','RS','110','17',5,'dec',NULL,'Feeder road','ফিডার রোড',NULL,'LGED','স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)','unverified');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Narayanganj','নারায়ণগঞ্জ','Narayanganj Sadar','নারায়ণগঞ্জ সদর','Narayanganj Sadar','নারায়ণগঞ্জ সদর','SA','111','33',15,'dec','Demo Sheet 9','City road','শহরের সড়ক',45,'City Corporation','সিটি কর্পোরেশন','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Narayanganj','নারায়ণগঞ্জ','Narayanganj Sadar','নারায়ণগঞ্জ সদর','Narayanganj Sadar','নারায়ণগঞ্জ সদর','BS','112','27',2,'katha',NULL,'Narrow lane','সরু গলি',8,'City Corporation','সিটি কর্পোরেশন','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Munshiganj','মুন্সীগঞ্জ','Munshiganj Sadar','মুন্সীগঞ্জ সদর','Bhabanipur','ভবানীপুর','CS','113','4',20,'dec','Demo Sheet 2','Rural road','গ্রামীণ সড়ক',14,'Union Parishad','ইউনিয়ন পরিষদ','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Narsingdi','নরসিংদী','Narsingdi Sadar','নরসিংদী সদর','Karimpur','করিমপুর','RS','114','18',7,'dec',NULL,'Union road','ইউনিয়ন সড়ক',26,'Union Parishad','ইউনিয়ন পরিষদ','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Dhaka','ঢাকা','Tangail','টাঙ্গাইল','Tangail Sadar','টাঙ্গাইল সদর','Rampur','রামপুর','BS','115','6',5,'katha','Demo Sheet 14','Municipal road','পৌর সড়ক',12,'Pourashava','পৌরসভা','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Chattogram','চট্টগ্রাম','Chattogram','চট্টগ্রাম','Hathazari','হাটহাজারী','Fatehpur','ফতেপুর','SA','116','11',1.5,'bigha',NULL,'Highway service road','হাইওয়ের সার্ভিস রোড',36,'Roads and Highways Dept','সড়ক ও জনপথ অধিদপ্তর','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Chattogram','চট্টগ্রাম','Chattogram','চট্টগ্রাম','Hathazari','হাটহাজারী','Alipur','আলীপুর','RS','117','25',9,'dec','Demo Sheet 8','Link road','সংযোগ সড়ক',22,'LGED','স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Rajshahi','রাজশাহী','Rajshahi','রাজশাহী','Paba','পবা','Shantipur','শান্তিপুর','BS','118','3',6,'katha',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Rajshahi','রাজশাহী','Rajshahi','রাজশাহী','Paba','পবা','Gopalpur','গোপালপুর','CS','119','14',18,'dec','Demo Sheet 11','Union road','ইউনিয়ন সড়ক',10,'Union Parishad','ইউনিয়ন পরিষদ','demo');
INSERT INTO land_plots (division_en,division_bn,district_en,district_bn,upazila_en,upazila_bn,mouza_en,mouza_bn,survey_type,khatian_no,dag_no,area,area_unit,map_ref,road_type_en,road_type_bn,road_width_ft,road_authority_en,road_authority_bn,road_info_status) VALUES ('Khulna','খুলনা','Khulna','খুলনা','Dumuria','ডুমুরিয়া','Nayapara','নয়াপাড়া','RS','120','29',4,'katha','Demo Sheet 6','Municipal road','পৌর সড়ক',30,'Pourashava','পৌরসভা','demo');

INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Union Parishad','ইউনিয়ন পরিষদ',0,12,4,2,2);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Union Parishad','ইউনিয়ন পরিষদ',12,24,6,3,3);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Union Parishad','ইউনিয়ন পরিষদ',24,40,8,4,4);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Union Parishad','ইউনিয়ন পরিষদ',40,999,10,5,5);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Pourashava','পৌরসভা',0,12,5,3,3);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Pourashava','পৌরসভা',12,24,8,4,4);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Pourashava','পৌরসভা',24,40,10,5,5);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Pourashava','পৌরসভা',40,999,15,6,6);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('City Corporation','সিটি কর্পোরেশন',0,12,6,3,3);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('City Corporation','সিটি কর্পোরেশন',12,24,9,4,4);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('City Corporation','সিটি কর্পোরেশন',24,40,12,5,5);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('City Corporation','সিটি কর্পোরেশন',40,999,15,6,6);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Roads and Highways Dept','সড়ক ও জনপথ অধিদপ্তর',0,12,10,4,4);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Roads and Highways Dept','সড়ক ও জনপথ অধিদপ্তর',12,24,12,5,5);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Roads and Highways Dept','সড়ক ও জনপথ অধিদপ্তর',24,40,15,6,6);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('Roads and Highways Dept','সড়ক ও জনপথ অধিদপ্তর',40,999,20,8,8);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('LGED','স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)',0,12,5,2.5,2.5);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('LGED','স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)',12,24,8,3,3);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('LGED','স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)',24,40,10,4,4);
INSERT INTO setback_rules (authority_en,authority_bn,min_width_ft,max_width_ft,front_ft,side_ft,rear_ft) VALUES ('LGED','স্থানীয় সরকার প্রকৌশল অধিদপ্তর (এলজিইডি)',40,999,12,5,5);
