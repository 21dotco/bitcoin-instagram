import json
import os
import sys
import subprocess
import sqlite3

#import from the 21 Developer Library
from two1.commands.config import Config
from two1.wallet import Wallet
from two1.bitrequests import BitTransferRequests

#set up bitrequest client for BitTransfer requests
wallet = Wallet()
username = Config().username
requests = BitTransferRequests(wallet, username)

# obtain server address from command line argument
server_url = sys.argv[3]

#purchased directory path
if os.path.islink(__file__):
    file_path = os.path.realpath(__file__)
else:
    file_path = os.path.abspath(__file__)
pur_dir_path = file_path[0:-10] + '/static/purchased'

def purchased_db(filename):
    db_filename = file_path[0:-10] + '/management/myphotos.db'
    schema_filename = file_path[0:-10] + '/management/schema.sql'
    db_is_new = not os.path.exists(db_filename)

    #Connect to a database containing purchased photos and insert the recently purchased photo
    with sqlite3.connect(db_filename) as conn:
        if db_is_new:
            print('Creating schema')
            with open(schema_filename, 'rt') as f:
                schema = f.read()
            conn.executescript(schema)

        print("Adding purchased image to database")
        pic_path = "/static/purchased/" + filename
        conn.execute('Insert into purchased (photopath) values (?)',[pic_path])
        conn.commit()
        print("Recent purchase successfully added to the database")            
    
def buy_image():

    #Obtain pictured id from command line arg
    pic_num = sys.argv[1]

    #create url and request to purchase image for bitcoin
    sel_url = server_url+'/instagram/buy?id={0}&payout_address={1}'
    answer = requests.get(url=sel_url.format(int(pic_num), wallet.get_payout_address()), stream=True)

    #check the response code. If it is 200 then the image was purchased successfully. Else give an error.
    if answer.status_code != 200:
        print("Could not make an offchain payment. Please check that you have sufficient funds.")
    else:
        #obtain image filename from comand line arg
        filename = sys.argv[2]

        #open file handle to write contents of the file being streamed from server
        with open(filename, 'wb') as fd:
            for chunk in answer.iter_content(4096):
                fd.write(chunk)
        fd.close()

        #store the image to a folder called 'static/purchased'. create the folder if it is not present initially.
        if not os.path.isdir(pur_dir_path):
            subprocess.check_output([
                "mkdir",
                pur_dir_path])
            
        subprocess.check_output([
            "mv",
            filename,
            pur_dir_path + '/.'])
        
        print("Congratulations, you just purchased the image {0} for {1} satoshi!".format(filename, answer.amount_paid))
        print("The image is stored at the following location: {0}".format(pur_dir_path + '/' + filename))

        #Insert purchased image into a database of purchased pictures
        purchased_db(filename)

if __name__ == '__main__':
    buy_image()
