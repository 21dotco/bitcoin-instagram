"""Flask server for Bitcoin Instagram."""

import sqlite3
import os
import sys

dir_path = 'static/' + sys.argv[1] + '/preview'
pic_list = os.listdir('../' + dir_path)

db_filename = 'myphotos.db'
schema_filename = 'schema.sql'

db_is_new = not os.path.exists(db_filename)

with sqlite3.connect(db_filename) as conn:
    if db_is_new:
        print('Creating schema')
        with open(schema_filename, 'rt') as f:
            schema = f.read()
        conn.executescript(schema)

        print("Adding data to database")

        for pic_num in range(len(pic_list)):
            pic_path = dir_path + "/" + pic_list[pic_num]
            conn.execute('Insert into photos (photopath, price) values (?, ?)',
                         [pic_path, 500])
            conn.commit()
        print("Entries successfully added to the database")
        
    else:
        print("Database exists, assume schema does too!!")
