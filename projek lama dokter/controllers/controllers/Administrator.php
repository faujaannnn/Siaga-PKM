<?php

if (!defined('BASEPATH'))
    exit('No direct script access allowed');

class Administrator extends CI_Controller
{
    function __construct()
    {
        parent::__construct();
        if ($this->session->userdata('username') == null) {
            redirect(site_url('Baseweb/login_admin'));
        }
        $this->load->model('Baseweb_model', 'Baseweb');
        $this->load->library('form_validation');
        $this->load->library('datatables');
    }

    public function index()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;

        $this->template->load('template_admin', 'administrator/admin_index', $data);
    }

    function hariIndo($id)
    {
        switch ($id) {
            case 'Sunday':
                return 'Minggu';
            case 'Monday':
                return 'Senin';
            case 'Tuesday':
                return 'Selasa';
            case 'Wednesday':
                return 'Rabu';
            case 'Thursday':
                return 'Kamis';
            case 'Friday':
                return 'Jumat';
            case 'Saturday':
                return 'Sabtu';
            default:
                return 'hari tidak valid';
        }
    }

    function bulanIndo($id)
    {
        switch ($id) {
            case 1:
                return 'Januari';
            case 2:
                return 'Februari';
            case 3:
                return 'Maret';
            case 4:
                return 'April';
            case 5:
                return 'Mei';
            case 6:
                return 'Juni';
            case 7:
                return 'Juli';
            case 8:
                return 'Agustus';
            case 9:
                return 'September';
            case 10:
                return 'Oktober';
            case 11:
                return 'November';
            case 12:
                return 'Desember';
            default:
                return 'Bulan tidak valid';
        }
    }

    public function blokir_akses()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;

        $this->template->load('template_admin', 'administrator/blokir_akses', $data);
    }

    public function kontrol_panel()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;

        #Tampil data kontrol
        $data['count'] = $this->Baseweb->getAllAdmin()->num_rows();
        $data['pengguna'] = $this->Baseweb->getAllAdmin()->result();

        $this->template->load('template_admin', 'administrator/kontrol_panel', $data);
    }

    public function addUser()
    {


        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;

        $this->template->load('template_admin', 'administrator/tambah_user', $data);
    }

    function PostTambahAdmin()
    {
        $password       = $this->input->post('password', TRUE);
        $options        = array("cost" => 4);
        $hashPassword   = password_hash($password, PASSWORD_BCRYPT, $options);

        $data = array(
            'nama_admin'      => $this->input->post('nama'),
            'username'  => $this->input->post('username'),
            'password'  => $hashPassword,
            'konfirmasi'   => $password,
            'log_admin'   => 1
        );
        $this->Baseweb->PostAdmin($data);
        $this->session->set_flashdata('message', 'Tambah Admin Berhasil');
        redirect('Administrator/kontrol_panel');
    }

    function DelUser($id)
    {
        $this->Baseweb->DelUser($id);
        $this->session->set_flashdata('message', 'Data user berhasil dihapus');
        redirect('Administrator/kontrol_panel');
    }

    function UbahUser($id)
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        #Data User
        $data['user'] = $this->Baseweb->AmbilAdmin($id)->row_array();

        $this->template->load('template_admin', 'administrator/update_user', $data);
    }

    public function banner_utama()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        #Data Banner
        $data['banner'] = $this->Baseweb->GetAllBanner()->result();

        $this->template->load('template_admin', 'administrator/banner_utama', $data);
    }

    function tambah_banner_utama()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/tambah_banner_utama', $data);
    }

    function AddBannerUtama()
    {
        $cekUtamaLain = $this->Baseweb->GetBannerUtama()->num_rows();
        if ($cekUtamaLain > 0) {
            $ambilBanner = $this->Baseweb->GetBannerUtama()->row_array();
            $ubahkodeutama = array(
                'log_banner' => 0
            );
            $this->Baseweb->UbahKodeUtamaBanner($ambilBanner['id_banner'], $ubahkodeutama);
            $file_banner = $this->upload_file();
            if (empty($file_banner)) {
                $this->session->set_flashdata('message', 'File banner tidak dapat di upload. Silahkan cek kembali ukuran banner tersebut. Ukuran maksimum adalah 500kb');
                redirect(site_url('Administrator/tambah_banner_utama'));
            } else {
                $data = array(
                    'judul_banner'   => $this->input->post('judul_banner'),
                    'foto'          => $file_banner['file_name'],
                    'log_banner'    => 1,
                    'tgl_upload'    => date('Y-m-d')
                );
                $this->Baseweb->PostBannerUtama($data);
                redirect('Administrator/banner_utama');
            }
        } else {
            $file_banner = $this->upload_file();
            if (empty($file_banner)) {
                $this->session->set_flashdata('message', 'File banner tidak dapat di upload. Silahkan cek kembali ukuran banner tersebut. Ukuran maksimum adalah 500kb');
                redirect(site_url('Administrator/tambah_banner_utama'));
            } else {
                $data = array(
                    'judul_banner'   => $this->input->post('judul_banner'),
                    'foto'          => $file_banner['file_name'],
                    'log_banner'    => 1,
                    'tgl_upload'    => date('Y-m-d')
                );
                $this->Baseweb->PostBannerUtama($data);
                redirect('Administrator/banner_utama');
            }
        }
    }


    function upload_file()
    {
        $tgl_banner = date('dmY' . 'His');
        $namafile = 'Banner_utama_' . $tgl_banner;
        $config['upload_path']          = './assets/img/banner/';
        $config['allowed_types']        = 'jpg|JPG|png|PNG|';
        $config['max_size']             = 10024;
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('foto_banner');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function ubahBannerUtama($id)
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        #Data Banner
        $data['banner'] = $this->Baseweb->GetDataBanner($id);

        $this->template->load('template_admin', 'administrator/Ubah_banner_utama', $data);
    }

    function Rubah_banner()
    {
        $id = $this->input->post('id_banner');
        $file_banner = $this->upload_file();
        if (empty($file_banner)) {
            $this->session->set_flashdata('message', 'File banner tidak dapat di upload. Silahkan cek kembali ukuran banner tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'judul_banner'   => $this->input->post('judul_banner'),
                'tgl_upload'    => date('Y-m-d')
            );
            $this->Baseweb->UbahKodeUtamaBanner($id, $data);
            redirect('Administrator/banner_utama');
        } else {
            $data = array(
                'judul_banner'   => $this->input->post('judul_banner'),
                'foto'          => $file_banner['file_name'],
                'tgl_upload'    => date('Y-m-d')
            );
            $this->Baseweb->UbahKodeUtamaBanner($id, $data);
            redirect('Administrator/banner_utama');
        }
    }

    public function literasi_peraturan()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['literasi'] = $this->Baseweb->getAturan();

        $this->template->load('template_admin', 'administrator/literasi_peraturan', $data);
    }

    function tambah_peraturan()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_literasi_peraturan', $data);
    }

    function AddLiterasiAturan()
    {
        $dokumen_aturan = $this->aturan();


        if (empty($dokumen_aturan)) {
            $this->session->set_flashdata('message', 'File aturan tidak dapat di upload. Silahkan cek kembali ukuran file tersebut. Ukuran maksimum adalah 5000kb');
            redirect(site_url('Administrator/tambah_peraturan'));
        } else {

            $data = array(
                'nama_peraturan' => $this->input->post('nama_aturan'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_peraturan' => date('Y-m-d'),
                'gambar' => 'hukum.jpg',
                'file' => $dokumen_aturan['file_name']
            );
            $this->Baseweb->PostAturan($data);
            redirect('Administrator/literasi_peraturan');
        }
    }

    function aturan()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Aturan_' . $tgl_upload;
        $config['upload_path']          = './assets/plugin_video/peraturan/';
        $config['allowed_types']        = 'pdf';

        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('file_aturan');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function gambar()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Gambar_' . $tgl_upload;
        $config['upload_path']          = './assets/plugin_video/img/';
        $config['allowed_types']        = 'jpg|JPG|png|PNG';
        $config['max_size']             = 1024;
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('file_gambar');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function edit_aturan($id)
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['aturan'] = $this->Baseweb->DataAturan($id);

        $this->template->load('template_admin', 'administrator/edit_literasi_aturan', $data);
    }

    function UbahLiterasiAturan()
    {
        $id = $this->input->post('id_peraturan');
        $file_gambar = $this->gambar();
        if (empty($file_gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'nama_peraturan' => $this->input->post('nama_aturan'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_peraturan' => $this->input->post('tgl_peraturan')

            );
            $this->Baseweb->Tambah_view_aturan($id, $data);
            redirect('Administrator/edit_aturan/' . $id);
        } else {

            $data = array(
                'nama_peraturan' => $this->input->post('nama_aturan'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_peraturan' => $this->input->post('tgl_peraturan'),
                'gambar' => $file_gambar['file_name']
            );
            $this->Baseweb->Tambah_view_aturan($id, $data);
            redirect('Administrator/edit_aturan/' . $id);
        }
    }

    function UbahFileLiterasiAturan()
    {
        $id = $this->input->post('id_peraturan');
        $dokumen_aturan = $this->aturan();
        if (empty($dokumen_aturan)) {
            $this->session->set_flashdata('message', 'File tidak dapat di upload. Silahkan cek kembali ukuran file tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/edit_aturan/' . $id);
        } else {

            $data = array(
                'file' => $dokumen_aturan['file_name']
            );
            $this->Baseweb->Tambah_view_aturan($id, $data);
            redirect('Administrator/edit_aturan/' . $id);
        }
    }

    function hapus_aturan($id)
    {
        $this->Baseweb->DelAturan($id);
        redirect('Administrator/literasi_peraturan');
    }

    public function literasi_materi()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['literasi'] = $this->Baseweb->getMateri();

        $this->template->load('template_admin', 'administrator/literasi_materi', $data);
    }

    function tambah_materi()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_literasi_materi', $data);
    }

    function AddLiterasiMateri()
    {
        $dokumen_materi = $this->materi();


        if (empty($dokumen_materi)) {
            $this->session->set_flashdata('message', 'File materi tidak dapat di upload. Silahkan cek kembali ukuran file tersebut. Ukuran maksimum adalah 5000kb');
            redirect(site_url('Administrator/tambah_materi'));
        } else {

            $data = array(
                'nama_materi' => $this->input->post('nama_materi'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_materi' => date('Y-m-d'),
                'gambar' => 'literasi_materi.png',
                'file' => $dokumen_materi['file_name']
            );
            $this->Baseweb->PostMateri($data);
            redirect('Administrator/literasi_materi');
        }
    }

    function materi()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Materi_' . $tgl_upload;
        $config['upload_path']          = './assets/plugin_video/materi/';
        $config['allowed_types']        = 'pdf';
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('file_materi');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function edit_materi($id)
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['materi'] = $this->Baseweb->DataMateri($id);

        $this->template->load('template_admin', 'administrator/edit_literasi_materi', $data);
    }

    function UbahLiterasiMateri()
    {
        $id = $this->input->post('id_materi');
        $file_gambar = $this->gambar();
        if (empty($file_gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'nama_materi' => $this->input->post('nama_materi'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_materi' => $this->input->post('tgl_materi')
            );
            $this->Baseweb->Tambah_view_materi($id, $data);
            redirect('Administrator/edit_materi/' . $id);
        } else {

            $data = array(
                'nama_materi' => $this->input->post('nama_materi'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_materi' => $this->input->post('tgl_materi'),
                'gambar' => $file_gambar['file_name']
            );
            $this->Baseweb->Tambah_view_materi($id, $data);
            redirect('Administrator/edit_materi/' . $id);
        }
    }

    function UbahFileLiterasiMateri()
    {
        $id = $this->input->post('id_materi');
        $dokumen_materi = $this->materi();
        if (empty($dokumen_materi)) {
            $this->session->set_flashdata('message', 'File tidak dapat di upload. Silahkan cek kembali ukuran file tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/edit_materi/' . $id);
        } else {

            $data = array(
                'file' => $dokumen_materi['file_name']
            );
            $this->Baseweb->Tambah_view_materi($id, $data);
            redirect('Administrator/edit_materi/' . $id);
        }
    }

    function hapus_materi($id)
    {
        $this->Baseweb->DelMateri($id);
        redirect('Administrator/literasi_materi');
    }
    public function literasi_video()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['literasi'] = $this->Baseweb->getVideo();

        $this->template->load('template_admin', 'administrator/literasi_video', $data);
    }

    function tambah_video()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_literasi_video', $data);
    }

    function AddLiterasiVideo()
    {
        $dokumen_video = $this->video();


        if (empty($dokumen_video)) {
            $this->session->set_flashdata('message', 'File video tidak dapat di upload. Silahkan cek kembali ukuran file tersebut. Ukuran maksimum adalah 5000kb');
            redirect(site_url('Administrator/tambah_video'));
        } else {

            $data = array(
                'nama_video' => $this->input->post('nama_video'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_video' => date('Y-m-d'),
                'gambar' => 'literasi_video.png',
                'file' => $dokumen_video['file_name']
            );
            $this->Baseweb->PostVideo($data);
            redirect('Administrator/literasi_video');
        }
    }

    function video()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Video_' . $tgl_upload;
        $config['upload_path']          = './assets/plugin_video/video/';
        $config['allowed_types']        = 'mp4';
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('file_video');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function edit_video($id)
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['video'] = $this->Baseweb->DataVideo($id);

        $this->template->load('template_admin', 'administrator/edit_literasi_video', $data);
    }

    function UbahLiterasiVideo()
    {
        $id = $this->input->post('id_video');
        $file_gambar = $this->gambar();
        if (empty($file_gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'nama_video' => $this->input->post('nama_video'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_video' => $this->input->post('tgl_video')

            );
            $this->Baseweb->Tambah_view_video($id, $data);
            redirect('Administrator/edit_video/' . $id);
        } else {

            $data = array(
                'nama_video' => $this->input->post('nama_video'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl_video' => $this->input->post('tgl_video'),
                'gambar' => $file_gambar['file_name']
            );
            $this->Baseweb->Tambah_view_video($id, $data);
            redirect('Administrator/edit_video/' . $id);
        }
    }

    function UbahFileLiterasiVideo()
    {
        $id = $this->input->post('id_video');
        $dokumen_video = $this->video();
        if (empty($dokumen_video)) {
            $this->session->set_flashdata('message', 'File tidak dapat di upload. Silahkan cek kembali ukuran file tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/edit_video/' . $id);
        } else {

            $data = array(
                'file' => $dokumen_video['file_name']
            );
            $this->Baseweb->Tambah_view_materi($id, $data);
            redirect('Administrator/edit_video/' . $id);
        }
    }

    function hapus_video($id)
    {
        $this->Baseweb->DelVideo($id);
        redirect('Administrator/literasi_video');
    }

    function logout()
    {
        $this->session->sess_destroy();
        $this->session->set_flashdata('status_login', 'Anda sudah berhasil keluar dari aplikasi');
        redirect(site_url('Baseweb'));
    }

    #AREA BERITA
    public function berita()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['berita'] = $this->Baseweb->getAllBerita();

        $this->template->load('template_admin', 'administrator/berita_index', $data);
    }

    function tambah_berita()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_berita', $data);
    }

    function AddBerita()
    {
        $gambar = $this->Ambilgambar();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/tambah_berita');
        } else {

            $data = array(
                'judul' => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl' => $this->input->post('tgl'),
                'gambar' => $gambar['file_name'],
                'author' => $this->input->post('author')
            );
            $this->Baseweb->PostBerita($data);
            redirect('Administrator/berita');
        }
    }

    function Ambilgambar()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Foto_' . $tgl_upload;
        $config['upload_path']          = './assets/img/berita/';
        $config['allowed_types']        = 'jpg|JPG|png|PNG';
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('gambar');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function edit_berita($id)
    {

        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['berita'] = $this->Baseweb->AmbilBerita($id);

        $this->template->load('template_admin', 'administrator/edit_berita', $data);
    }

    function UbahBerita()
    {
        $id = $this->input->post('id');
        $gambar = $this->Ambilgambar();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'judul'     => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl'       => $this->input->post('tgl'),
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutBerita($id, $data);
            redirect('Administrator/berita');
        } else {
            $data = array(
                'judul'     => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl'       => $this->input->post('tgl'),
                'gambar'    => $gambar['file_name'],
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutBerita($id, $data);
            redirect('Administrator/berita');
        }
    }

    function hapus_berita($id)
    {
        $this->Baseweb->DelBerita($id);
        redirect('Administrator/berita');
    }

    public function pengumuman()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['pengumuman'] = $this->Baseweb->getAllPengumuman();

        $this->template->load('template_admin', 'administrator/pengumuman_index', $data);
    }

    function tambah_pengumuman()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_pengumuman', $data);
    }

    function AddPengumuman()
    {
        $gambar = $this->AmbilgambarPengumuman();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/tambah_pengumuman');
        } else {

            $data = array(
                'judul' => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl' => $this->input->post('tgl'),
                'foto' => $gambar['file_name'],
                'author' => $this->input->post('author')
            );
            $this->Baseweb->PostPengumuman($data);
            redirect('Administrator/pengumuman');
        }
    }

    function AmbilgambarPengumuman()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Foto_' . $tgl_upload;
        $config['upload_path']          = './assets/img/pengumuman/';
        $config['allowed_types']        = 'jpg|JPG|png|PNG';
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('gambar');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function edit_pengumuman($id)
    {

        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['pengumuman'] = $this->Baseweb->AmbilPengumuman($id);

        $this->template->load('template_admin', 'administrator/edit_pengumuman', $data);
    }

    function UbahPengumuman()
    {
        $id = $this->input->post('id');
        $gambar = $this->AmbilgambarPengumuman();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'judul'     => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl'       => $this->input->post('tgl'),
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutPengumuman($id, $data);
            redirect('Administrator/berita');
        } else {
            $data = array(
                'judul'     => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl'       => $this->input->post('tgl'),
                'foto'      => $gambar['file_name'],
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutPengumuman($id, $data);
            redirect('Administrator/pengumuman');
        }
    }

    function hapus_Pengumuman($id)
    {
        $this->Baseweb->DelPengumuman($id);
        redirect('Administrator/pengumuman');
    }

    public function tips_bencana()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['tips_bencana'] = $this->Baseweb->getAllTipsBencana();

        $this->template->load('template_admin', 'administrator/tipsBencana_index', $data);
    }

    function tambah_tips_bencana()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_tips_bencana', $data);
    }

    function AddTipsBencana()
    {
        $gambar = $this->AmbilgambarTips();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/tambah_tips_bencana');
        } else {

            $data = array(
                'judul' => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl' => $this->input->post('tgl'),
                'gambar' => $gambar['file_name'],
                'author' => $this->input->post('author')
            );
            $this->Baseweb->PostTipsBencana($data);
            redirect('Administrator/tips_bencana');
        }
    }

    function AmbilgambarTips()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Foto_' . $tgl_upload;
        $config['upload_path']          = './assets/img/tips_bencana/';
        $config['allowed_types']        = 'jpg|JPG|png|PNG';
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('gambar');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function edit_tips_bencana($id)
    {

        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['tips_bencana'] = $this->Baseweb->AmbilTipsBencana($id);

        $this->template->load('template_admin', 'administrator/edit_tips_bencana', $data);
    }

    function UbahTipsBencana()
    {
        $id = $this->input->post('id');
        $gambar = $this->AmbilgambarTips();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'judul'     => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl'       => $this->input->post('tgl'),
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutTipsBencana($id, $data);
            redirect('Administrator/tips_bencana');
        } else {
            $data = array(
                'judul'     => $this->input->post('judul'),
                'deskripsi' => $this->input->post('deskripsi'),
                'tgl'       => $this->input->post('tgl'),
                'gambar'    => $gambar['file_name'],
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutTipsBencana($id, $data);
            redirect('Administrator/tips_bencana');
        }
    }

    function hapus_tips_bencana($id)
    {
        $this->Baseweb->DelTipsBencana($id);
        redirect('Administrator/tips_bencana');
    }

    public function info_pelatihan()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['info_pelatihan'] = $this->Baseweb->getAllInfoPelatihan();

        $this->template->load('template_admin', 'administrator/InfoPelatihan_index', $data);
    }

    function tambah_info_pelatihan()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_info_pelatihan', $data);
    }

    function AddInfoPelatihan()
    {
        $gambar = $this->AmbilgambarPelatihan();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/tambah_info_pelatihan');
        } else {

            $data = array(
                'judul' => $this->input->post('judul'),
                'tgl' => $this->input->post('tgl'),
                'gambar' => $gambar['file_name'],
                'author' => $this->input->post('author')
            );
            $this->Baseweb->PostInfoPelatihan($data);
            redirect('Administrator/info_pelatihan');
        }
    }

    function AmbilgambarPelatihan()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Foto_' . $tgl_upload;
        $config['upload_path']          = './assets/img/info_pelatihan/';
        $config['allowed_types']        = 'jpg|JPG|png|PNG';
        $config['file_name'] = $namafile;
        $config['overwrite'] = TRUE;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('gambar');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }

    function edit_info_pelatihan($id)
    {

        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['info_pelatihan'] = $this->Baseweb->AmbilInfoPelatihan($id);

        $this->template->load('template_admin', 'administrator/edit_info_pelatihan', $data);
    }

    function UbahInfoPelatihan()
    {
        $id = $this->input->post('id');
        $gambar = $this->AmbilgambarPelatihan();
        if (empty($gambar)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            $data = array(
                'judul'     => $this->input->post('judul'),
                'tgl'       => $this->input->post('tgl'),
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutInfoPelatihan($id, $data);
            redirect('Administrator/info_pelatihan');
        } else {
            $data = array(
                'judul'     => $this->input->post('judul'),
                'tgl'       => $this->input->post('tgl'),
                'gambar'    => $gambar['file_name'],
                'author'    => $this->input->post('author')
            );
            $this->Baseweb->PutInfoPelatihan($id, $data);
            redirect('Administrator/info_pelatihan');
        }
    }

    function hapus_info_pelatihan($id)
    {
        $this->Baseweb->DelInfoPelatihan($id);
        redirect('Administrator/info_pelatihan');
    }

    public function galeri()
    {

        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $data['galeri'] = $this->Baseweb->getAllGaleri()->result();

        $this->template->load('template_admin', 'administrator/galeri_index', $data);
    }

    function tambah_galeri()
    {
        #Tampil hari dan tanggal indonesia
        $hariInggris = date('l');
        $hariBahasaIndonesia = $this->hariIndo($hariInggris);
        $bulanInggris = date('m');
        $bulanIndonesia = $this->bulanIndo($bulanInggris);
        $tglskrg = date('d') . ' ' . $bulanIndonesia . ' ' . date('Y');

        $data['hari'] = $hariBahasaIndonesia;
        $data['tgl'] = $tglskrg;
        $data['tgl_cetak'] = $tglskrg;
        $data['tahun'] = date('Y');

        $this->template->load('template_admin', 'administrator/add_galeri', $data);
    }

    function postGaleri()
    {
        $foto = $this->ambilGaleri();
        if (empty($foto)) {
            $this->session->set_flashdata('message', 'Gambar tidak dapat di upload. Silahkan cek kembali ukuran gambar tersebut. Ukuran maksimum adalah 500kb');
            redirect('Administrator/galeri');
        } else {

            $data = array(
                'judul' => $this->input->post('judul'),
                'tgl_upload' => date('Y-m-d'),
                'foto' => $foto['file_name'],
                'log' => $this->input->post('log')
            );
            $this->Baseweb->postGaleri($data);
            redirect('Administrator/galeri');
        }
    }

    function ambilGaleri()
    {
        $tgl_upload = date('dmY' . 'His');
        $namafile = 'Foto_' . $tgl_upload;
        $config['upload_path']          = './assets/img/foto/';
        $config['allowed_types']        = 'jpg|JPG|png|PNG';
        $config['file_name'] = $namafile;
        $this->load->library('upload', $config);
        $q = $this->upload->do_upload('gambar');
        if (empty($q)) {
            return false;
        } else {
            return $this->upload->data();
        }
    }
}
