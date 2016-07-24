"""Flask server for Bitcoin Instagram."""
#Import all the Python dependencies needed to run the server
import json
import sqlite3
import os
import sys

from flask import Flask
from flask import request
from flask import Response
from flask import render_template
from flask import g
from flask import send_from_directory
from flask.ext.basicauth import BasicAuth

#Import from the 21 Developer Library
from two1.wallet import Wallet
from two1.bitserv.flask import Payment

app = Flask(__name__, static_folder='static', template_folder='templates')
wallet = Wallet()
payment = Payment(app, wallet)
file_path = os.path.abspath(__file__)

#Define database config variables incase you want to password protect your DB
DATABASE = file_path[0:-10] + '/management/myphotos.db'
DEBUG = False
#SECRET_KEY = 'development key'
BASIC_AUTH_USERNAME = 'admin'
BASIC_AUTH_PASSWORD = 'default'

app.config.from_object(__name__)
basic_auth = BasicAuth(app)

#This method connects to an existing database
def connect_db():
    rv = sqlite3.connect(app.config['DATABASE'])
    rv.row_factory = sqlite3.Row
    return rv

def get_db():
    if not hasattr(g, 'sqlite_db'):
        g.sqlite_db = connect_db()
    return g.sqlite_db
    
@app.before_request
def before_request():
    g.db = connect_db()

@app.teardown_request
def close_db(error):
    if hasattr(g, 'sqlite_db'):
        g.sqlite_db.close()

#This route will display a user's purchased images on a webpage
@app.route('/instagram/purchased')
@basic_auth.required
def show_purchased_photos():

    #Connect to the DB
    db = get_db()

    #Select all entries in the DB
    cur = db.execute('select id, photopath from purchased order by id desc')
    entries = cur.fetchall()

    #render the database entries on a webpage
    return render_template('index_purchased.html', purchased=entries)

#This route will display a user's Instagram content on a webpage        
@app.route('/instagram')
def show_photos():
    
    """Show photos in grid."""
    #Connect to the DB
    db = get_db()

    #Select all entries in the DB
    cur = db.execute('select id, photopath, price from photos order by id asc')
    entries = cur.fetchall()

    #render the database entries on a webpage
    return render_template('index.html', photos=entries)

#This method is used to obtain the price of an image once the users enters the image id
def get_price_from_id(request):

    #Obtain image id from user's response
    id = int(request.args.get('id'))

    #Connect to the DB
    db = get_db()

    #create query to select the image requested by the client and extract its price
    query = "select photopath, price from photos where id = ?"

    #execute query
    cur = db.execute(query, (id,))
    pic_path, pic_price = cur.fetchall()[0]

    #return price of image to the payment required decorator
    return pic_price

#This method is used to obtain the file name of the image selected by the user for purchase
def get_pic_name(id):

    #Connect to the DB
    db = get_db()

    #create query to select the image requested by the client and extract its name
    query = "select photopath, price from photos where id = ?"

    #execute query
    cur = db.execute(query, (id,))
    pic_path, pic_price = cur.fetchall()[0]
    pic_name = pic_path.split("/")

    #return image filename
    return pic_name[3]

#This method executes the buy command and transfers the file to the user
@app.route('/instagram/buy', methods=["GET"])
@payment.required(get_price_from_id)
def buy_photos():
    """Buy a photo."""

    photo_id = int(request.args.get('id'))
    pic_name = get_pic_name(photo_id)
    dir_path = 'static/' + sys.argv[1] + '/img'
    return send_from_directory(dir_path, pic_name)


if __name__ == '__main__':
    app.run(host='0.0.0.0')
#             port=5000)
